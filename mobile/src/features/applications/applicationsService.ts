import type { INetwork } from "@/services/network";
import { readInventory } from "@/features/inventory/inventoryRead";
import type { OperationsService } from "@/features/operations/operationsService";
import type { GetApplicantProfileResponse } from "@/features/applicantProfile/types";
import { toProfileFormInput, toResidenceFormInput } from "@/features/applicantProfile/forms/utils";
import { ApplicationsRepository } from "./applicationsRepository";
import { ApplicationEditorRepository } from "./applicationEditorRepository";
import { applicationActionInputSchema, applicationListSchema } from "./applicationValidation";
import {
  informationSnapshot,
  residencesSnapshot,
  sectionSnapshot,
  type ApplicationEditorInput,
  type ApplicationSection,
  type ApplicationStep,
} from "./forms";
import type { ApplicationCommands } from "./operations/types";
import type { GetApplicationsRequestParams, IApplicationsApi } from "./types";

export type ApplicationMutationOptions = { replacesOperationId?: string };

export class ApplicationsService {
  constructor(
    private readonly api: IApplicationsApi,
    private readonly repository: ApplicationsRepository,
    private readonly editors: ApplicationEditorRepository,
    private readonly operations: OperationsService,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
  ) {}

  async getApplications(params: GetApplicationsRequestParams = {}, signal?: AbortSignal) {
    this.assertActive();
    const valid = applicationListSchema.parse(params);
    const account = await this.repository.account();
    if (account.role === "Applicant" && valid.showArchived)
      throw new Error("Applicants cannot request showArchived.");
    return readInventory(
      this.network,
      this.sessionSignal,
      signal,
      (requestSignal) => this.api.getApplications(valid, requestSignal),
      () => this.repository.getApplications(valid),
      (response) => this.repository.savePage(response),
    );
  }

  async getApplication(id: string, signal?: AbortSignal) {
    this.assertActive();
    const result = await readInventory(
      this.network,
      this.sessionSignal,
      signal,
      (requestSignal) => this.api.getApplication({ id }, requestSignal),
      () => this.requireDetail(id),
      (response) => this.repository.saveDetail(response),
    );
    const data = await this.requireDetail(id);
    this.assertActive();
    return { ...result, data };
  }

  async startDraft(unitId: string) {
    this.assertActive();
    const account = await this.requireApplicant();
    return this.editors.create(account.id, unitId, account.email);
  }

  async openEditor(id: string) {
    this.assertActive();
    const account = await this.requireApplicant();
    const existing = await this.editors.get(id);
    if (existing) return existing;
    const { data } = await this.getApplication(id);
    if (
      data.application.applicantId !== account.id ||
      !["Draft", "Returned"].includes(data.application.status)
    )
      throw new Error("This application cannot be edited.");
    return this.editors.create(account.id, data.application.unitId, account.email, data);
  }

  getEditor(id: string) {
    this.assertActive();
    return this.editors.get(id);
  }

  getLocalDrafts() {
    this.assertActive();
    return this.editors.localDrafts();
  }

  async saveDraft(id: string, input: ApplicationEditorInput, step?: ApplicationStep) {
    this.assertActive();
    await this.requireApplicant();
    return this.editors.saveInput(id, input, step);
  }

  async copyProfileSection(
    id: string,
    section: ApplicationSection,
    profile: GetApplicantProfileResponse,
    confirmedReplacement: boolean,
  ) {
    this.assertActive();
    const editor = await this.requireEditor(id);
    if (!confirmedReplacement) throw new Error("Confirm replacing the local section input.");
    const input = { ...editor.input };
    if (section === "ApplicantInformation")
      input.applicantInformation = toProfileFormInput(profile.applicantInformation);
    else input.residenceHistory = profile.residenceHistory.map(toResidenceFormInput);
    await this.saveDraft(id, input);
  }

  async continueApplicantInformation(id: string, options: ApplicationMutationOptions = {}) {
    this.assertActive();
    await this.requireApplicant();
    const editor = await this.requireEditor(id);
    const applicantInformation = informationSnapshot(editor.input);
    let create = editor.lifecycle === "LocalOnly";
    if (editor.lifecycle === "CreationPending") {
      const creations = (await this.operations.getAll()).filter(
        (operation) => operation.resourceId === id && operation.command === "CreateApplication",
      );
      const latest = creations.at(-1);
      if (latest?.state === "Rejected") {
        if (options.replacesOperationId !== latest.id)
          throw new Error(
            "Correct and explicitly replace the rejected creation before continuing.",
          );
        create = true;
      } else if (!latest || latest.state === "Cancelled") create = true;
    }
    if (create) {
      return this.operations.perform(
        {
          command: "CreateApplication",
          resourceType: "Application",
          resourceId: id,
          intent: { id, unitId: editor.unitId, applicantInformation },
          ...options,
          resources: [{ resourceType: "Unit", resourceId: editor.unitId, accessMode: "Read" }],
        },
        (operation, tx) =>
          this.editors.saveContinue(operation, "ApplicantInformation", editor.input, tx),
      );
    }
    return this.operations.perform(
      {
        command: "UpdateApplicationInformation",
        resourceType: "Application",
        resourceId: id,
        intent: { id, expectedVersion: editor.baseVersion ?? "1", applicantInformation },
        ...options,
        resources: [{ resourceType: "Unit", resourceId: editor.unitId, accessMode: "Read" }],
      },
      (operation, tx) =>
        this.editors.saveContinue(operation, "ApplicantInformation", editor.input, tx),
    );
  }

  async continueResidenceHistory(id: string, options: ApplicationMutationOptions = {}) {
    this.assertActive();
    await this.requireApplicant();
    const editor = await this.requireEditor(id);
    if (editor.lifecycle === "LocalOnly") throw new Error("Continue Applicant Information first.");
    return this.operations.perform(
      {
        command: "UpdateApplicationResidences",
        resourceType: "Application",
        resourceId: id,
        intent: {
          id,
          expectedVersion: editor.baseVersion ?? "1",
          residenceHistory: residencesSnapshot(editor.input),
        },
        ...options,
        resources: [{ resourceType: "Unit", resourceId: editor.unitId, accessMode: "Read" }],
      },
      (operation, tx) => this.editors.saveContinue(operation, "ResidenceHistory", editor.input, tx),
    );
  }

  async getSummary(id: string) {
    this.assertActive();
    return this.editors.transaction(async (tx) => {
      const editor = await this.editors.get(id, tx);
      if (!editor) throw new Error("No local application editor is available.");
      const snapshots = await this.editors.snapshots(id, tx);
      let hasUnfinishedEdits = false;
      for (const section of ["ApplicantInformation", "ResidenceHistory"] as const) {
        try {
          if (
            JSON.stringify(sectionSnapshot(section, editor.input)) !==
            snapshots[section]?.payloadJson
          )
            hasUnfinishedEdits = true;
        } catch {
          hasUnfinishedEdits = true;
        }
      }
      return {
        snapshots,
        hasUnfinishedEdits,
        applicantInformation: snapshots.ApplicantInformation
          ? JSON.parse(snapshots.ApplicantInformation.payloadJson)
          : null,
        residenceHistory: snapshots.ResidenceHistory
          ? JSON.parse(snapshots.ResidenceHistory.payloadJson)
          : null,
        sectionsAccepted: Boolean(
          snapshots.ApplicantInformation?.accepted && snapshots.ResidenceHistory?.accepted,
        ),
      };
    });
  }

  async submitApplication(
    input: ApplicationCommands["SubmitApplication"]["input"],
    options: ApplicationMutationOptions = {},
  ) {
    this.assertActive();
    await this.requireApplicant();
    const intent = applicationActionInputSchema.parse(input);
    const editor = await this.requireEditor(intent.id);
    const summary = await this.getSummary(intent.id);
    if (
      summary.hasUnfinishedEdits ||
      !summary.snapshots.ApplicantInformation ||
      !summary.snapshots.ResidenceHistory
    )
      throw new Error("Continue both sections and resolve unfinished edits before submitting.");
    await this.editors.assertEditable(intent.id, undefined, options.replacesOperationId);
    if ((await this.network.isOnline()) && !summary.sectionsAccepted)
      throw new Error("Both sections must be accepted by the server before submitting online.");
    return this.operations.perform(
      {
        command: "SubmitApplication",
        resourceType: "Application",
        resourceId: intent.id,
        intent,
        ...options,
        resources: [{ resourceType: "Unit", resourceId: editor.unitId, accessMode: "Read" }],
      },
      async (_operation, tx) => {
        const current = await this.editors.get(intent.id, tx);
        if (!current || JSON.stringify(current.input) !== JSON.stringify(editor.input))
          throw new Error("Application input changed before submission.");
        await this.editors.assertEditable(intent.id, tx, _operation.id);
        await this.repository.assertNoPendingAction(
          intent.id,
          editor.unitId,
          _operation.id,
          false,
          tx,
        );
        const currentSnapshots = await this.editors.snapshots(intent.id, tx);
        if (
          currentSnapshots.ApplicantInformation?.id !==
            summary.snapshots.ApplicantInformation?.id ||
          currentSnapshots.ResidenceHistory?.id !== summary.snapshots.ResidenceHistory?.id
        )
          throw new Error("Continue snapshots changed before submission.");
        await this.editors.assertSnapshotsDeliverable(intent.id, tx);
      },
    );
  }

  async withdrawApplication(
    input: ApplicationCommands["WithdrawApplication"]["input"],
    options: ApplicationMutationOptions = {},
  ) {
    this.assertActive();
    await this.requireApplicant();
    const intent = applicationActionInputSchema.parse(input);
    const detail = await this.requireDetail(intent.id);
    if (!["Draft", "Submitted", "InReview", "Returned"].includes(detail.application.status))
      throw new Error("Only open applications can be withdrawn.");
    return this.operations.perform(
      {
        command: "WithdrawApplication",
        resourceType: "Application",
        resourceId: intent.id,
        intent,
        ...options,
        resources: [
          { resourceType: "Unit", resourceId: detail.application.unitId, accessMode: "Read" },
        ],
      },
      (operation, tx) =>
        this.repository.assertNoPendingAction(
          intent.id,
          detail.application.unitId,
          operation.id,
          false,
          tx,
        ),
    );
  }

  async discardLocalDraft(id: string, confirmed: boolean) {
    this.assertActive();
    await this.requireApplicant();
    if (!confirmed) throw new Error("Confirm discarding the local draft.");
    return this.editors.discard(id, this.operations.repository);
  }

  async closeEditor(id: string, confirmed: boolean) {
    this.assertActive();
    await this.requireApplicant();
    if (!confirmed) throw new Error("Confirm discarding local editor input.");
    return this.editors.close(id);
  }

  private async requireDetail(id: string) {
    const detail = await this.repository.getDetail(id);
    if (!detail)
      throw new Error(
        "This application is unavailable offline. Download its complete details first.",
      );
    return detail;
  }

  private async requireEditor(id: string) {
    const editor = await this.editors.get(id);
    if (!editor) throw new Error("No local application editor is available.");
    return editor;
  }

  private async requireApplicant() {
    const account = await this.repository.account();
    if (account.role !== "Applicant")
      throw new Error("Only applicants can edit application sections.");
    return account;
  }

  private assertActive() {
    if (this.sessionSignal.aborted) throw new Error("The session is no longer active.");
  }
}
