import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { resourceVersionSchema } from "@/features/operations/commandSchemas";
import type { IDatabaseQueries } from "@/services/database/types";
import type { JournalOperation } from "@/features/operations/types";

/** The submitted snapshot and journal entry commit together; neither is accepted inventory. */
export async function saveInventoryIntent(operation: JournalOperation, tx: IDatabaseQueries) {
  const { expectedVersion } = z
    .looseObject({ expectedVersion: resourceVersionSchema.optional() })
    .parse(JSON.parse(operation.intentJson));
  const formId = `inventory:${operation.resourceType}:${operation.resourceId}:${operation.command}`;
  const snapshotId = uuidv7();
  await tx.runAsync(
    `INSERT INTO local_forms (id, resourceType, resourceId, formType, inputJson, baseVersion, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET inputJson = excluded.inputJson, baseVersion = excluded.baseVersion, updatedAt = excluded.updatedAt`,
    [
      formId,
      operation.resourceType,
      operation.resourceId,
      operation.command,
      operation.intentJson,
      expectedVersion ?? null,
      operation.createdAt,
      operation.createdAt,
    ],
  );
  await tx.runAsync(
    `INSERT INTO form_snapshots (id, formId, section, revision, payloadJson, createdAt)
     SELECT ?, ?, ?, COALESCE(MAX(revision), 0) + 1, ?, ? FROM form_snapshots WHERE formId = ? AND section = ?`,
    [
      snapshotId,
      formId,
      operation.command,
      operation.intentJson,
      operation.createdAt,
      formId,
      operation.command,
    ],
  );
  await tx.runAsync("INSERT INTO operation_snapshots (operationId, snapshotId) VALUES (?, ?)", [
    operation.id,
    snapshotId,
  ]);
}
