import type { IDatabaseQueries, ITransactionalDatabase, SqlValue } from "@/services/database/types";
import type {
  AffectedResourceDto,
  EnqueueOperation,
  JournalOperation,
  OperationListItem,
} from "./types";

export class PendingResourceOperationsError extends Error {
  constructor() {
    super(
      "This resource has unresolved operations. Sync or resolve them before submitting online.",
    );
    this.name = "PendingResourceOperationsError";
  }
}

const unresolved = "state IN ('Queued', 'Dispatched', 'Rejected') AND dismissedAt IS NULL";

export class OperationsRepository {
  constructor(private readonly db: ITransactionalDatabase) {}

  transaction<T>(task: (tx: IDatabaseQueries) => Promise<T>): Promise<T> {
    return this.db.withTransactionAsync(task);
  }

  get(id: string, tx: IDatabaseQueries = this.db): Promise<JournalOperation | null> {
    return tx.getFirstAsync<JournalOperation>("SELECT * FROM operations WHERE id = ?", [id]);
  }

  getAll(): Promise<OperationListItem[]> {
    return this.db.getAllAsync<OperationListItem>(
      `SELECT o.*,
        (SELECT p.id FROM operation_dependencies d JOIN operations p ON p.id = d.dependsOnOperationId
         WHERE d.operationId = o.id AND p.state <> 'Accepted' ORDER BY p.sequence LIMIT 1) AS waitingOnOperationId,
        (WITH RECURSIVE ancestors(id) AS (
           SELECT dependsOnOperationId FROM operation_dependencies WHERE operationId = o.id
           UNION
           SELECT d.dependsOnOperationId FROM operation_dependencies d JOIN ancestors a ON d.operationId = a.id
         ) SELECT p.id FROM ancestors a JOIN operations p ON p.id = a.id
           WHERE p.state IN ('Rejected', 'Cancelled') OR p.replayBlockCode IS NOT NULL
           ORDER BY p.sequence LIMIT 1) AS blockedByOperationId
       FROM operations o ORDER BY o.sequence`,
    );
  }

  async insert(
    id: string,
    input: EnqueueOperation,
    tx: IDatabaseQueries,
  ): Promise<JournalOperation> {
    const account = await tx.getFirstAsync<{ environmentGeneration: string }>(
      "SELECT environmentGeneration FROM session_account WHERE singleton = 1",
    );
    if (!account) throw new Error("No active account is available.");
    if (input.replacesOperationId) {
      const replaced = await this.get(input.replacesOperationId, tx);
      if (
        !replaced ||
        replaced.state !== "Rejected" ||
        replaced.resourceType !== input.resourceType ||
        replaced.resourceId !== input.resourceId
      ) {
        throw new Error("Only a rejected operation on the same resource can be replaced.");
      }
      await this.cancel(replaced.id, true, tx);
    }
    const resources = [
      {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        accessMode: "Write" as const,
      },
      ...(input.resources ?? []).filter(
        (r) => r.resourceType !== input.resourceType || r.resourceId !== input.resourceId,
      ),
    ];
    const dependencies = new Set(input.dependsOn ?? []);
    for (const resource of resources) {
      const previous = await tx.getFirstAsync<JournalOperation>(
        `SELECT o.* FROM operations o JOIN operation_resources r ON r.operationId = o.id
         WHERE r.resourceType = ? AND r.resourceId = ?
           AND (r.accessMode = 'Write' OR ? = 'Write')
           AND o.${unresolved}
         ORDER BY o.sequence DESC LIMIT 1`,
        [resource.resourceType, resource.resourceId, resource.accessMode],
      );
      if (previous && input.executionMode === "Immediate")
        throw new PendingResourceOperationsError();
      if (previous) dependencies.add(previous.id);
    }
    const now = new Date().toISOString();
    await tx.runAsync(
      `INSERT INTO operations
       (id, environmentGeneration, command, resourceType, resourceId, executionMode,
        intentJson, replacesOperationId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        account.environmentGeneration,
        input.command,
        input.resourceType,
        input.resourceId,
        input.executionMode,
        JSON.stringify(input.intent),
        input.replacesOperationId ?? null,
        now,
        now,
      ],
    );
    for (const resource of resources) {
      await tx.runAsync(
        "INSERT INTO operation_resources (operationId, resourceType, resourceId, accessMode) VALUES (?, ?, ?, ?)",
        [id, resource.resourceType, resource.resourceId, resource.accessMode],
      );
    }
    for (const dependency of dependencies) {
      const predecessor = await this.get(dependency, tx);
      if (!predecessor || predecessor.state === "Cancelled")
        throw new Error("Invalid operation dependency.");
      if (input.executionMode === "Immediate" && predecessor.state !== "Accepted") {
        throw new PendingResourceOperationsError();
      }
      await tx.runAsync(
        "INSERT INTO operation_dependencies (operationId, dependsOnOperationId) VALUES (?, ?)",
        [id, dependency],
      );
    }
    for (const snapshotId of input.snapshotIds ?? []) {
      await tx.runAsync("INSERT INTO operation_snapshots (operationId, snapshotId) VALUES (?, ?)", [
        id,
        snapshotId,
      ]);
    }
    return (await this.get(id, tx))!;
  }

  getDependencies(id: string, tx: IDatabaseQueries = this.db): Promise<JournalOperation[]> {
    return tx.getAllAsync<JournalOperation>(
      `SELECT p.* FROM operation_dependencies d JOIN operations p ON p.id = d.dependsOnOperationId
       WHERE d.operationId = ? ORDER BY p.sequence`,
      [id],
    );
  }

  async getPredecessorVersion(
    operation: JournalOperation,
    tx: IDatabaseQueries,
  ): Promise<string | undefined> {
    const row = await tx.getFirstAsync<{ version: string }>(
      `SELECT a.version FROM operation_dependencies d
       JOIN operations p ON p.id = d.dependsOnOperationId
       JOIN operation_affected_resources a ON a.operationId = p.id
       WHERE d.operationId = ? AND p.state = 'Accepted'
         AND a.resourceType = ? AND a.resourceId = ? AND a.version IS NOT NULL
       ORDER BY p.sequence DESC LIMIT 1`,
      [operation.id, operation.resourceType, operation.resourceId],
    );
    return row?.version;
  }

  async saveAffectedResources(
    id: string,
    resources: AffectedResourceDto[],
    tx: IDatabaseQueries,
  ): Promise<void> {
    for (const resource of resources) {
      await tx.runAsync(
        `INSERT INTO operation_affected_resources (operationId, resourceType, resourceId, version)
         VALUES (?, ?, ?, ?) ON CONFLICT(operationId, resourceType, resourceId)
         DO UPDATE SET version = excluded.version`,
        [id, resource.resourceType, resource.id, resource.version],
      );
    }
  }

  getEligible(now: string, excludedIds: string[] = []): Promise<JournalOperation[]> {
    return this.db.getAllAsync<JournalOperation>(
      `SELECT o.* FROM operations o
       WHERE o.state IN ('Queued', 'Dispatched') AND o.replayBlockCode IS NULL
         AND (o.nextAttemptAt IS NULL OR o.nextAttemptAt <= ?)
         AND NOT EXISTS (
           SELECT 1 FROM operation_dependencies d JOIN operations p ON p.id = d.dependsOnOperationId
           WHERE d.operationId = o.id AND p.state <> 'Accepted'
         )
          ${excludedIds.length ? `AND o.id NOT IN (${excludedIds.map(() => "?").join(", ")})` : ""}
        ORDER BY o.sequence LIMIT 1`,
      [now, ...excludedIds],
    );
  }

  async update(
    id: string,
    values: Partial<
      Pick<
        JournalOperation,
        | "executionMode"
        | "frozenRequestJson"
        | "state"
        | "attemptCount"
        | "nextAttemptAt"
        | "firstDispatchedAt"
        | "lastAttemptAt"
        | "replayBlockCode"
        | "errorCategory"
        | "errorCode"
        | "errorMessage"
        | "errorDetailsJson"
        | "httpStatus"
        | "responseJson"
        | "responseSchemaVersion"
        | "dismissedAt"
      >
    >,
    tx: IDatabaseQueries = this.db,
  ): Promise<void> {
    const entries = Object.entries({ ...values, updatedAt: new Date().toISOString() });
    await tx.runAsync(
      `UPDATE operations SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, value]) => value as SqlValue), id],
    );
  }

  async removeImmediate(id: string, tx: IDatabaseQueries): Promise<void> {
    const references = await tx.getFirstAsync<{ count: number }>(
      `SELECT (SELECT count(*) FROM operation_dependencies WHERE dependsOnOperationId = ?)
        + (SELECT count(*) FROM application_editor_sections WHERE acceptedOperationId = ?)
        + (SELECT count(*) FROM operations WHERE replacesOperationId = ?) AS count`,
      [id, id, id],
    );
    if (references?.count) return;
    await tx.runAsync("DELETE FROM operation_dependencies WHERE operationId = ?", [id]);
    await tx.runAsync("DELETE FROM operations WHERE id = ? AND executionMode = 'Immediate'", [id]);
  }

  async cancel(id: string, dismiss = false, tx?: IDatabaseQueries): Promise<void> {
    if (!tx) return this.transaction((transaction) => this.cancel(id, dismiss, transaction));
    const operation = await this.get(id, tx);
    if (
      !operation ||
      !["Queued", "Rejected"].includes(operation.state) ||
      (operation.state === "Queued" && operation.firstDispatchedAt)
    ) {
      throw new Error("Only proven-unsent or rejected operations can be cleared.");
    }
    const descendants = await tx.getAllAsync<JournalOperation>(
      `WITH RECURSIVE chain(id) AS (
          SELECT operationId FROM operation_dependencies WHERE dependsOnOperationId = ?
          UNION SELECT d.operationId FROM operation_dependencies d JOIN chain c ON d.dependsOnOperationId = c.id
         ) SELECT o.* FROM operations o JOIN chain c ON c.id = o.id`,
      [id],
    );
    if (descendants.some((o) => o.state === "Dispatched" || o.state === "Accepted")) {
      throw new Error("Dispatched or accepted work must be reconciled, not cancelled.");
    }
    for (const child of descendants) {
      if (child.state === "Queued") await this.update(child.id, { state: "Cancelled" }, tx);
    }
    await this.update(
      id,
      {
        state: operation.state === "Rejected" ? "Rejected" : "Cancelled",
        dismissedAt: dismiss || operation.state === "Rejected" ? new Date().toISOString() : null,
      },
      tx,
    );
  }
}
