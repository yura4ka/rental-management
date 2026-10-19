import { uuidv7 } from "uuidv7";
import { HTTPError } from "@/services/api";
import type { IDatabaseQueries } from "@/services/database/types";
import type { INetwork } from "@/services/network";
import {
  CommandCatalog,
  CommandDataError,
  type BoundCommand,
  type CommandContracts,
  type EnqueueCommand,
  type ValidatedOutcome,
} from "./commandCatalog";
import type { Commands } from "./commands";
import { OperationsRepository } from "./operationsRepository";
import type { IOperationsApi, JournalOperation, JournalResponse, OperationResult } from "./types";

type AttemptOrigin = "UserAction" | "QueueProcessor";
type PreparationResult =
  | { status: "Deferred" }
  | { status: "AlreadyAccepted"; response: JournalResponse }
  | { status: "Ready"; operation: JournalOperation; command: BoundCommand };
type DeliveryResult =
  | { status: "Received"; response: unknown; httpStatus: number | null }
  | { status: "Rejected"; response: unknown; httpStatus: number }
  | { status: "Blocked"; code: string };

export class OperationsService<C extends CommandContracts = Commands> {
  private readonly active = new Set<string>();
  private processing: Promise<void> | null = null;

  constructor(
    readonly repository: OperationsRepository,
    private readonly api: IOperationsApi,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
    private readonly authorizeReplay: () => Promise<unknown>,
    private readonly catalog: CommandCatalog<C>,
    private readonly newId: () => string = uuidv7,
  ) {}

  getAll() {
    return this.repository.getAll();
  }

  /** Can participate in the same transaction as a feature's valid form snapshot. */
  async enqueue<K extends keyof C & string>(
    input: EnqueueCommand<C, K>,
    tx?: IDatabaseQueries,
  ): Promise<JournalOperation> {
    this.assertActive();
    const validated = { ...input, intent: this.catalog.validateInput(input.command, input.intent) };
    const id = this.newId();
    return tx
      ? this.repository.insert(id, validated, tx)
      : this.repository.transaction((transaction) =>
          this.repository.insert(id, validated, transaction),
        );
  }

  /** Entry point for online feature actions. Offline callers should enqueue Queued work. */
  async perform<K extends keyof C & string>(
    input: Omit<EnqueueCommand<C, K>, "executionMode">,
    saveIntent?: (operation: JournalOperation, tx: IDatabaseQueries) => Promise<void>,
  ): Promise<OperationResult<C[K]["response"]>> {
    this.assertActive();
    const online = await this.network.isOnline();
    const operation = await this.repository.transaction(async (tx) => {
      const saved = await this.enqueue(
        { ...input, executionMode: online ? "Immediate" : "Queued" },
        tx,
      );
      await saveIntent?.(saved, tx);
      return saved;
    });
    if (!online) return { status: "Pending", operationId: operation.id };
    const result = await this.execute(operation.id, "UserAction");
    return result.status === "Accepted"
      ? { ...result, data: this.catalog.parseResponse(input.command, result.data) }
      : result;
  }

  /** Retains results for queued work, including work originally dispatched before a crash. */
  async process(id: string): Promise<OperationResult> {
    return this.execute(id, "QueueProcessor");
  }

  /** FIFO among eligible operations; a rejected chain does not stop unrelated work. */
  processPending(): Promise<void> {
    this.processing ??= this.processEligible().finally(() => {
      this.processing = null;
    });
    return this.processing;
  }

  cancel(id: string): Promise<void> {
    this.assertActive();
    return this.repository.cancel(id);
  }

  async dismiss(id: string): Promise<void> {
    this.assertActive();
    const operation = await this.repository.get(id);
    if (!operation) return;
    if (operation.state === "Queued" || operation.state === "Rejected") {
      await this.repository.cancel(id, true);
    } else if (operation.state === "Accepted" || operation.state === "Cancelled") {
      await this.repository.update(id, { dismissedAt: new Date().toISOString() });
    } else {
      throw new Error("An uncertain operation must be reconciled before clearing it.");
    }
  }

  /** Explicitly resume after restoring authentication; protocol/business failures are not rebased. */
  async resumeAfterAuthentication(): Promise<void> {
    this.assertActive();
    await this.authorizeReplay();
    for (const operation of await this.repository.getAll()) {
      if (operation.replayBlockCode === "AuthenticationRequired") {
        await this.repository.update(operation.id, { replayBlockCode: null, nextAttemptAt: null });
      }
    }
  }

  private async processEligible(): Promise<void> {
    this.assertActive();
    if (!(await this.network.isOnline())) return;
    const attempted = new Set<string>();
    while (true) {
      const [operation] = await this.repository.getEligible(new Date().toISOString(), [
        ...attempted,
        ...this.active,
      ]);
      if (!operation) break;
      attempted.add(operation.id);
      if (!(await this.network.isOnline())) break;
      await this.process(operation.id);
    }
  }

  private async execute(id: string, origin: AttemptOrigin): Promise<OperationResult> {
    this.assertActive();
    if (this.active.has(id)) return { status: "Pending", operationId: id };
    this.active.add(id);
    try {
      if (!(await this.network.isOnline())) {
        await this.repository.update(id, { executionMode: "Queued" });
        return { status: "Pending", operationId: id };
      }
      await this.authorizeReplay();
      this.assertActive();
      const prepared = await this.prepareAttempt(id, origin);
      if (prepared.status === "Deferred") return { status: "Pending", operationId: id };
      if (prepared.status === "AlreadyAccepted") {
        return { status: "Accepted", operationId: id, data: prepared.response };
      }
      let delivery: DeliveryResult;
      // Only network/recovery calls are caught here. Finalization failures stay recoverable.
      try {
        delivery = await this.sendOrRecover(prepared.operation, prepared.command, origin);
      } catch (error) {
        return await this.handleExecutionError(prepared.operation, error, origin);
      }
      return await this.finalizeOutcome(prepared.operation, prepared.command, delivery, origin);
    } finally {
      this.active.delete(id);
    }
  }

  /** Validate prerequisites and freeze the request atomically before any transport. */
  private prepareAttempt(id: string, origin: AttemptOrigin): Promise<PreparationResult> {
    return this.repository.transaction(async (tx) => {
      this.assertActive();
      const operation = await this.repository.get(id, tx);
      if (!operation) throw new Error("Operation not found.");
      if (operation.state === "Accepted") {
        try {
          const command = this.catalog.bind(operation);
          return {
            status: "AlreadyAccepted",
            response: command.receive(JSON.parse(operation.responseJson!)).response,
          };
        } catch (error) {
          if (!(error instanceof CommandDataError) && !(error instanceof SyntaxError)) throw error;
          await this.blockReplay(
            id,
            error instanceof CommandDataError ? error.code : "InvalidResponse",
            tx,
          );
          return { status: "Deferred" };
        }
      }
      if (
        !["Queued", "Dispatched"].includes(operation.state) ||
        operation.replayBlockCode ||
        (operation.nextAttemptAt && operation.nextAttemptAt > new Date().toISOString())
      ) {
        return { status: "Deferred" };
      }
      const account = await tx.getFirstAsync<{ environmentGeneration: string }>(
        "SELECT environmentGeneration FROM session_account WHERE singleton = 1",
      );
      if (account?.environmentGeneration !== operation.environmentGeneration) {
        await this.blockReplay(id, "EnvironmentGenerationMismatch", tx);
        return { status: "Deferred" };
      }
      const dependencies = await this.repository.getDependencies(id, tx);
      if (dependencies.some((dependency) => dependency.state !== "Accepted"))
        return { status: "Deferred" };
      const predecessorVersion = await this.repository.getPredecessorVersion(operation, tx);
      let command: BoundCommand;
      try {
        command = this.catalog.bind(operation, predecessorVersion);
      } catch (error) {
        if (!(error instanceof CommandDataError)) throw error;
        await this.blockReplay(id, error.code, tx);
        return { status: "Deferred" };
      }
      const now = new Date().toISOString();
      await this.repository.update(
        id,
        {
          executionMode: origin === "UserAction" ? operation.executionMode : "Queued",
          state: "Dispatched",
          frozenRequestJson: command.frozenRequestJson,
          firstDispatchedAt: operation.firstDispatchedAt ?? now,
          lastAttemptAt: now,
          attemptCount: operation.attemptCount + 1,
        },
        tx,
      );
      return { status: "Ready", operation: (await this.repository.get(id, tx))!, command };
    });
  }

  /** Network only: return receipt outcomes without writing to SQLite in the transport catch scope. */
  private async sendOrRecover(
    operation: JournalOperation,
    command: BoundCommand,
    origin: AttemptOrigin,
  ): Promise<DeliveryResult> {
    if (origin === "QueueProcessor" && operation.attemptCount > 1) {
      const receipt = await this.api.getOperation(
        {
          operationId: operation.id,
          environmentGeneration: operation.environmentGeneration,
        },
        this.sessionSignal,
      );
      this.assertActive();
      if (
        !["Accepted", "Rejected", "Unknown"].includes(receipt.outcome) ||
        (receipt.outcome !== "Unknown" &&
          (receipt.operationId !== operation.id || receipt.responseSchemaVersion !== 1))
      ) {
        return { status: "Blocked", code: "UnsupportedReceipt" };
      }
      if (receipt.outcome === "Rejected")
        return {
          status: "Rejected",
          response: receipt.response,
          httpStatus: receipt.httpStatus ?? 409,
        };
      if (receipt.outcome === "Accepted")
        return { status: "Received", response: receipt.response, httpStatus: receipt.httpStatus };
    }
    return {
      status: "Received",
      response: await command.execute(this.sessionSignal),
      httpStatus: null,
    };
  }

  private async finalizeOutcome(
    operation: JournalOperation,
    command: BoundCommand,
    delivery: DeliveryResult,
    origin: AttemptOrigin,
  ): Promise<OperationResult> {
    this.assertActive();
    if (delivery.status === "Blocked") {
      await this.blockReplay(operation.id, delivery.code);
    } else if (delivery.status === "Rejected") {
      await this.reject(operation, delivery.response, delivery.httpStatus, false);
    } else {
      let outcome: ValidatedOutcome;
      try {
        outcome = command.receive(delivery.response);
      } catch (error) {
        if (!(error instanceof CommandDataError)) throw error;
        await this.blockReplay(operation.id, error.code);
        return { status: "Pending", operationId: operation.id };
      }
      await this.accept(operation, outcome, delivery.httpStatus, origin);
      return { status: "Accepted", operationId: operation.id, data: outcome.response };
    }
    return { status: "Pending", operationId: operation.id };
  }

  private async accept(
    operation: JournalOperation,
    outcome: ValidatedOutcome,
    httpStatus: number | null,
    origin: AttemptOrigin,
  ): Promise<void> {
    await this.repository.transaction(async (tx) => {
      this.assertActive();
      await outcome.persist(tx);
      await this.repository.saveAffectedResources(
        operation.id,
        outcome.response.affectedResources,
        tx,
      );
      await this.repository.update(
        operation.id,
        {
          state: "Accepted",
          responseJson: JSON.stringify(outcome.response),
          responseSchemaVersion: 1,
          httpStatus,
          errorCategory: null,
          errorCode: null,
          errorMessage: null,
          errorDetailsJson: null,
          nextAttemptAt: null,
          replayBlockCode: null,
        },
        tx,
      );
      if (origin === "UserAction" && operation.executionMode === "Immediate")
        await this.repository.removeImmediate(operation.id, tx);
    });
  }

  private async handleExecutionError(
    operation: JournalOperation,
    error: unknown,
    origin: AttemptOrigin,
  ): Promise<OperationResult> {
    this.assertActive();
    if (this.isReceiptedRejection(error, operation)) {
      const immediate = origin === "UserAction";
      await this.reject(operation, error.body, error.status, immediate);
      if (immediate) throw error;
    } else {
      await this.recordUncertain(operation, error);
    }
    return { status: "Pending", operationId: operation.id };
  }

  private blockReplay(id: string, code: string, tx?: IDatabaseQueries): Promise<void> {
    return this.repository.update(
      id,
      {
        executionMode: "Queued",
        replayBlockCode: code,
        errorCategory: "Recovery",
        errorCode: code,
      },
      tx,
    );
  }

  private isReceiptedRejection(error: unknown, operation: JournalOperation): error is HTTPError {
    if (!(error instanceof HTTPError) || ![409, 422].includes(error.status)) return false;
    const body = error.body as { operationId?: string; code?: string } | null;
    return (
      body?.operationId === operation.id &&
      !["OperationIdConflict", "EnvironmentGenerationMismatch"].includes(body.code ?? "")
    );
  }

  private async reject(
    operation: JournalOperation,
    body: unknown,
    status: number,
    immediate: boolean,
  ): Promise<void> {
    const problem = body as { code?: string; title?: string } | null;
    await this.repository.transaction(async (tx) => {
      await this.repository.update(
        operation.id,
        {
          state: "Rejected",
          httpStatus: status,
          responseJson: JSON.stringify(body),
          responseSchemaVersion: 1,
          errorCategory: status === 422 ? "Validation" : "Business",
          errorCode: problem?.code ?? null,
          errorMessage: problem?.title ?? `HTTP ${status}`,
          errorDetailsJson: JSON.stringify(body),
          nextAttemptAt: null,
        },
        tx,
      );
      if (immediate && operation.executionMode === "Immediate")
        await this.repository.removeImmediate(operation.id, tx);
    });
  }

  private async recordUncertain(operation: JournalOperation, error: unknown): Promise<void> {
    const http = error instanceof HTTPError ? error : null;
    const problem = http?.body as { code?: string } | null;
    const transient = !http || [408, 429].includes(http.status) || http.status >= 500;
    const retryAfter = http?.response.headers.get("Retry-After");
    const retrySeconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
    const retryDate = retryAfter ? Date.parse(retryAfter) : NaN;
    const delay =
      Math.min(60_000, 1000 * 2 ** Math.min(operation.attemptCount, 6)) *
      (0.5 + Math.random() * 0.5);
    await this.repository.update(operation.id, {
      executionMode: "Queued",
      errorCategory: http?.status === 401 ? "Authentication" : transient ? "Transport" : "Recovery",
      errorCode: problem?.code ?? null,
      errorMessage: error instanceof Error ? error.message : "Operation outcome is uncertain.",
      errorDetailsJson: http ? JSON.stringify(http.body) : null,
      httpStatus: http?.status ?? null,
      replayBlockCode: transient
        ? null
        : http?.status === 401
          ? "AuthenticationRequired"
          : (problem?.code ?? `HTTP${http?.status}`),
      nextAttemptAt: transient
        ? new Date(
            Math.max(
              Date.now() + delay,
              Date.now() + retrySeconds,
              Number.isNaN(retryDate) ? 0 : retryDate,
            ),
          ).toISOString()
        : null,
    });
  }

  private assertActive(): void {
    if (this.sessionSignal.aborted) throw new Error("The session is no longer active.");
  }
}
