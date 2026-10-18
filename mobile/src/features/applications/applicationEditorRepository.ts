import { uuidv7 } from "uuidv7";
import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import type { JournalOperation } from "@/features/operations/types";
import { OperationsRepository } from "@/features/operations/operationsRepository";
import {
  editorDefaults,
  sectionSnapshot,
  type ApplicationEditorInput,
  type ApplicationSection,
  type ApplicationStep,
} from "./forms";
import type { GetApplicationResponse } from "./types";

export type ApplicationEditor = {
  formId: string;
  applicationId: string;
  applicantId: string;
  unitId: string;
  lifecycle: "LocalOnly" | "CreationPending" | "ServerLinked";
  currentStep: ApplicationStep;
  baseVersion: string | null;
  input: ApplicationEditorInput;
};

type EditorRow = Omit<ApplicationEditor, "input"> & { inputJson: string };

export type ContinueSnapshot = { id: string; payloadJson: string; accepted: boolean };

export class ApplicationEditorRepository {
  constructor(private readonly db: ITransactionalDatabase) {}

  transaction<T>(task: (tx: IDatabaseQueries) => Promise<T>) {
    return this.db.withTransactionAsync(task);
  }

  async get(id: string, tx: IDatabaseQueries = this.db): Promise<ApplicationEditor | null> {
    const row = await tx.getFirstAsync<EditorRow>(
      `SELECT e.*, f.baseVersion, f.inputJson FROM application_editors e JOIN local_forms f ON f.id = e.formId WHERE e.applicationId = ?`,
      [id],
    );
    if (!row) return null;
    const { inputJson, ...editor } = row;
    return { ...editor, input: JSON.parse(inputJson) };
  }

  async localDrafts(): Promise<ApplicationEditor[]> {
    const rows = await this.db.getAllAsync<{ applicationId: string }>(
      "SELECT applicationId FROM application_editors WHERE lifecycle IN ('LocalOnly', 'CreationPending') ORDER BY applicationId",
    );
    const editors = await Promise.all(rows.map((row) => this.get(row.applicationId)));
    return editors.filter((editor): editor is ApplicationEditor => editor !== null);
  }

  async create(
    applicantId: string,
    unitId: string,
    email: string,
    detail?: GetApplicationResponse,
  ): Promise<ApplicationEditor> {
    return this.transaction(async (tx) => {
      const existing = await tx.getFirstAsync<{ applicationId: string }>(
        "SELECT applicationId FROM application_editors WHERE applicantId = ? AND unitId = ?",
        [applicantId, unitId],
      );
      if (existing) {
        if (detail && existing.applicationId !== detail.application.id)
          throw new Error(
            "An editor already exists for this unit. Close it before editing another application.",
          );
        const editor = (await this.get(existing.applicationId, tx))!;
        if (!detail && editor.lifecycle === "ServerLinked")
          throw new Error(
            "Close the previous application editor before starting another draft for this unit.",
          );
        return editor;
      }
      if (!detail) {
        const open = await tx.getFirstAsync<{ id: string }>(
          "SELECT id FROM applications WHERE applicantId = ? AND unitId = ? AND status IN ('Draft', 'Submitted', 'InReview', 'Returned') LIMIT 1",
          [applicantId, unitId],
        );
        if (open) throw new Error("An open application already exists for this unit.");
      }
      const id = detail?.application.id ?? uuidv7();
      const formId = `application:${id}`;
      const input = editorDefaults(detail?.applicantInformation, detail?.residenceHistory, email);
      const now = new Date().toISOString();
      await tx.runAsync(
        "INSERT INTO local_forms (id, formType, resourceType, resourceId, baseVersion, inputJson, createdAt, updatedAt) VALUES (?, 'ApplicationEditor', 'Application', ?, ?, ?, ?, ?)",
        [formId, id, detail?.application.version ?? null, JSON.stringify(input), now, now],
      );
      await tx.runAsync(
        "INSERT INTO application_editors (formId, applicationId, applicantId, unitId, lifecycle, currentStep) VALUES (?, ?, ?, ?, ?, 'ApplicantInformation')",
        [formId, id, applicantId, unitId, detail ? "ServerLinked" : "LocalOnly"],
      );
      for (const section of ["ApplicantInformation", "ResidenceHistory"] as const) {
        await tx.runAsync(
          "INSERT INTO application_editor_sections (formId, section) VALUES (?, ?)",
          [formId, section],
        );
        if (
          detail &&
          (section === "ApplicantInformation" || detail.residenceHistorySavedAt !== null)
        ) {
          const snapshotId = await this.snapshot(
            formId,
            section,
            sectionSnapshot(section, input),
            tx,
          );
          await tx.runAsync(
            "UPDATE application_editor_sections SET latestContinueSnapshotId = ?, acceptedSnapshotId = ? WHERE formId = ? AND section = ?",
            [snapshotId, snapshotId, formId, section],
          );
        }
      }
      return (await this.get(id, tx))!;
    });
  }

  async saveInput(
    id: string,
    input: ApplicationEditorInput,
    step?: ApplicationStep,
  ): Promise<void> {
    await this.transaction(async (tx) => {
      await this.assertEditable(id, tx);
      await tx.runAsync(
        "UPDATE local_forms SET inputJson = ?, updatedAt = ? WHERE id = (SELECT formId FROM application_editors WHERE applicationId = ?)",
        [JSON.stringify(input), new Date().toISOString(), id],
      );
      if (step)
        await tx.runAsync(
          "UPDATE application_editors SET currentStep = ? WHERE applicationId = ?",
          [step, id],
        );
    });
  }

  async assertEditable(
    id: string,
    tx: IDatabaseQueries = this.db,
    excludedOperationId?: string,
  ): Promise<void> {
    const row = await tx.getFirstAsync<{ status: string }>(
      "SELECT status FROM applications WHERE id = ?",
      [id],
    );
    if (row && !["Draft", "Returned"].includes(row.status))
      throw new Error("Only Draft or Returned applications can be edited.");
    const lock = await tx.getFirstAsync<{ id: string }>(
      `SELECT o.id FROM operations o JOIN operation_resources r ON r.operationId = o.id WHERE ((r.resourceType = 'Application' AND r.resourceId = ?)
      OR (r.resourceType = 'Unit' AND r.resourceId = (SELECT unitId FROM application_editors WHERE applicationId = ?) AND o.command = 'RejectAllApplications'))
      AND o.state IN ('Queued', 'Dispatched', 'Rejected') AND o.dismissedAt IS NULL
      AND o.id <> ? AND o.command IN ('SubmitApplication', 'WithdrawApplication', 'ReturnApplication', 'DenyApplication', 'ApproveApplication', 'ReleaseApplication', 'RejectAllApplications') LIMIT 1`,
      [id, id, excludedOperationId ?? ""],
    );
    if (lock) throw new Error("Resolve the pending application action before editing.");
  }

  async saveContinue(
    operation: JournalOperation,
    section: ApplicationSection,
    expectedInput: ApplicationEditorInput,
    tx: IDatabaseQueries,
  ) {
    await this.assertEditable(operation.resourceId, tx);
    const editor = await this.get(operation.resourceId, tx);
    if (!editor || JSON.stringify(editor.input) !== JSON.stringify(expectedInput))
      throw new Error("Application input changed. Continue again with the latest input.");
    const snapshotId = await this.snapshot(
      editor.formId,
      section,
      sectionSnapshot(section, editor.input),
      tx,
    );
    await tx.runAsync("INSERT INTO operation_snapshots (operationId, snapshotId) VALUES (?, ?)", [
      operation.id,
      snapshotId,
    ]);
    await tx.runAsync(
      "UPDATE application_editor_sections SET latestContinueSnapshotId = ? WHERE formId = ? AND section = ?",
      [snapshotId, editor.formId, section],
    );
    if (operation.command === "CreateApplication")
      await tx.runAsync(
        "UPDATE application_editors SET lifecycle = 'CreationPending' WHERE applicationId = ?",
        [editor.applicationId],
      );
    if (operation.executionMode === "Queued") await this.advance(editor.applicationId, section, tx);
  }

  advance(id: string, section: ApplicationSection, tx: IDatabaseQueries = this.db) {
    return tx.runAsync("UPDATE application_editors SET currentStep = ? WHERE applicationId = ?", [
      section === "ApplicantInformation" ? "ResidenceHistory" : "Summary",
      id,
    ]);
  }

  async snapshots(
    id: string,
    tx: IDatabaseQueries = this.db,
  ): Promise<Partial<Record<ApplicationSection, ContinueSnapshot>>> {
    const rows = await tx.getAllAsync<{
      section: ApplicationSection;
      id: string;
      payloadJson: string;
      accepted: number;
    }>(
      `SELECT e.section, s.id, s.payloadJson, (e.acceptedSnapshotId = s.id) AS accepted FROM application_editor_sections e
      JOIN application_editors a ON a.formId = e.formId JOIN form_snapshots s ON s.id = e.latestContinueSnapshotId WHERE a.applicationId = ?`,
      [id],
    );
    return Object.fromEntries(
      rows.map((row) => [row.section, { ...row, accepted: Boolean(row.accepted) }]),
    );
  }

  async assertSnapshotsDeliverable(id: string, tx: IDatabaseQueries): Promise<void> {
    const sections = await tx.getAllAsync<{ section: ApplicationSection; deliverable: number }>(
      `SELECT e.section,
      (e.latestContinueSnapshotId IS NOT NULL AND (e.acceptedSnapshotId = e.latestContinueSnapshotId OR EXISTS (
        SELECT 1 FROM operation_snapshots os JOIN operations o ON o.id = os.operationId
        WHERE os.snapshotId = e.latestContinueSnapshotId AND o.state IN ('Queued', 'Dispatched') AND o.dismissedAt IS NULL
      ))) AS deliverable FROM application_editor_sections e JOIN application_editors a ON a.formId = e.formId WHERE a.applicationId = ?`,
      [id],
    );
    if (sections.length !== 2 || sections.some((section) => !section.deliverable))
      throw new Error("Continue rejected or cancelled sections again before submitting.");
  }

  async discard(id: string, operations: OperationsRepository): Promise<void> {
    await this.transaction(async (tx) => {
      const editor = await this.get(id, tx);
      if (!editor) return;
      const server = await tx.getFirstAsync<{ id: string }>(
        "SELECT id FROM applications WHERE id = ?",
        [id],
      );
      if (editor.lifecycle === "ServerLinked" || server)
        throw new Error("Server applications must be withdrawn, not discarded.");
      const creates = await tx.getAllAsync<JournalOperation>(
        "SELECT * FROM operations WHERE resourceType = 'Application' AND resourceId = ? AND command = 'CreateApplication' AND state <> 'Cancelled'",
        [id],
      );
      for (const operation of creates) {
        if (
          operation.state === "Accepted" ||
          operation.state === "Dispatched" ||
          (operation.firstDispatchedAt && operation.state !== "Rejected")
        )
          throw new Error("Creation must be reconciled before discarding this draft.");
        await operations.cancel(operation.id, true, tx);
      }
      await this.deleteInput(editor.formId, tx);
    });
  }

  async close(id: string): Promise<void> {
    await this.transaction(async (tx) => {
      const editor = await this.get(id, tx);
      if (!editor) return;
      if (editor.lifecycle !== "ServerLinked")
        throw new Error("Discard local drafts using the draft-discard action.");
      const pending = await tx.getFirstAsync<{ id: string }>(
        "SELECT id FROM operations WHERE resourceType = 'Application' AND resourceId = ? AND state IN ('Queued', 'Dispatched', 'Rejected') AND dismissedAt IS NULL LIMIT 1",
        [id],
      );
      if (pending) throw new Error("Resolve pending work before discarding editor input.");
      await this.deleteInput(editor.formId, tx);
    });
  }

  private async deleteInput(formId: string, tx: IDatabaseQueries) {
    await tx.runAsync(
      "DELETE FROM operation_snapshots WHERE snapshotId IN (SELECT id FROM form_snapshots WHERE formId = ?)",
      [formId],
    );
    await tx.runAsync("DELETE FROM application_editor_sections WHERE formId = ?", [formId]);
    await tx.runAsync("DELETE FROM application_editors WHERE formId = ?", [formId]);
    await tx.runAsync("DELETE FROM form_snapshots WHERE formId = ?", [formId]);
    await tx.runAsync("DELETE FROM local_forms WHERE id = ?", [formId]);
  }

  private async snapshot(
    formId: string,
    section: ApplicationSection,
    payload: unknown,
    tx: IDatabaseQueries,
  ): Promise<string> {
    const id = uuidv7();
    await tx.runAsync(
      "INSERT INTO form_snapshots (id, formId, section, revision, payloadJson, createdAt) SELECT ?, ?, ?, COALESCE(MAX(revision), 0) + 1, ?, ? FROM form_snapshots WHERE formId = ? AND section = ?",
      [id, formId, section, JSON.stringify(payload), new Date().toISOString(), formId, section],
    );
    return id;
  }
}
