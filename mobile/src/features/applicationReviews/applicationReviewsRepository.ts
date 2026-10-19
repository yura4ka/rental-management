import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import type { ApplicationsRepository } from "@/features/applications/applicationsRepository";
import type { SaveManagerNoteResponse, RejectAllApplicationsResponse } from "./types";

/** Review details share the application repository; notes and bulk acknowledgements are independent. */
export class ApplicationReviewsRepository {
  constructor(
    private readonly db: ITransactionalDatabase,
    private readonly applications: ApplicationsRepository,
  ) {}

  async saveNote(response: SaveManagerNoteResponse, tx?: IDatabaseQueries): Promise<void> {
    if (!tx)
      return this.db.withTransactionAsync((transaction) => this.saveNote(response, transaction));
    const operation = await tx.getFirstAsync<{ resourceId: string }>(
      "SELECT resourceId FROM operations WHERE id = ? AND command = 'SaveManagerNote'",
      [response.operationId],
    );
    if (!operation) throw new Error("The note operation target is unavailable.");
    await this.applications.saveNote(operation.resourceId, response, tx);
    const form = await tx.getFirstAsync<{ baseVersion: string | null }>(
      "SELECT baseVersion FROM local_forms WHERE id = ?",
      [`managerNote:${operation.resourceId}`],
    );
    if (form && (!form.baseVersion || BigInt(form.baseVersion) <= BigInt(response.version)))
      await tx.runAsync("UPDATE local_forms SET baseVersion = ? WHERE id = ?", [
        response.version,
        `managerNote:${operation.resourceId}`,
      ]);
  }

  async saveBulkResult(
    response: RejectAllApplicationsResponse,
    tx: IDatabaseQueries,
  ): Promise<void> {
    // Compact acknowledgements are not application snapshots. Preserve details and let
    // affected-resource versions mark them outdated until a complete GET repairs them.
    if (response.affectedCount < 0) throw new Error("Invalid bulk rejection result.");
    // Operation finalization writes affectedResources in this same transaction.
    // Rejecting applications does not change unit availability.
    void tx;
  }

  async saveNoteInput(id: string, body: string, baseVersion: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO local_forms (id, formType, resourceType, resourceId, baseVersion, inputJson, createdAt, updatedAt)
      VALUES (?, 'ManagerNote', 'ManagerNote', ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET inputJson = excluded.inputJson, baseVersion = excluded.baseVersion, updatedAt = excluded.updatedAt`,
      [`managerNote:${id}`, id, baseVersion, JSON.stringify({ body }), now, now],
    );
  }

  async getNoteInput(id: string) {
    const row = await this.db.getFirstAsync<{ inputJson: string; baseVersion: string | null }>(
      "SELECT inputJson, baseVersion FROM local_forms WHERE id = ?",
      [`managerNote:${id}`],
    );
    return row
      ? {
          body: (JSON.parse(row.inputJson) as { body: string }).body,
          expectedVersion: row.baseVersion,
        }
      : null;
  }

  async saveNoteIntent(
    operationId: string,
    id: string,
    body: string,
    baseVersion: string | null,
    tx: IDatabaseQueries,
  ) {
    const formId = `managerNote:${id}`;
    const now = new Date().toISOString();
    await tx.runAsync(
      `INSERT INTO local_forms (id, formType, resourceType, resourceId, baseVersion, inputJson, createdAt, updatedAt)
      VALUES (?, 'ManagerNote', 'ManagerNote', ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
      [formId, id, baseVersion, JSON.stringify({ body }), now, now],
    );
    await tx.runAsync(
      `INSERT INTO form_snapshots (id, formId, section, revision, payloadJson, createdAt)
      SELECT ?, ?, 'ManagerNote', COALESCE(MAX(revision), 0) + 1, ?, ? FROM form_snapshots WHERE formId = ? AND section = 'ManagerNote'`,
      [operationId, formId, JSON.stringify({ body, expectedVersion: baseVersion }), now, formId],
    );
    await tx.runAsync("INSERT INTO operation_snapshots (operationId, snapshotId) VALUES (?, ?)", [
      operationId,
      operationId,
    ]);
  }
}
