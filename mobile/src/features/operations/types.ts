/** Protocol metadata sent with every business mutation, including identical retries. */
export type OperationRequestBody = {
  /** Client-generated UUIDv7, persisted before transport; reuse only for the same frozen request. */
  operationId: string;
  /** Server database generation captured at enqueue time; never rewrite it to replay old work. */
  environmentGeneration: string;
};

/** Server-reported change metadata for cache repair; not a complete resource snapshot. */
export type AffectedResourceDto = {
  /** Server resource kind, for example `Profile`, `Unit`, or `Application`. */
  resourceType: string;
  /** Canonical server ID of the affected resource. */
  id: string;
  /** Accepted decimal-string version, or null for an unversioned resource. Never convert to Number. */
  version: string | null;
};

/** Successful mutation payload, extended with acknowledgement and cache-invalidation metadata. */
export type MutationResponse<Data> = Data & {
  /** ID of the request acknowledged by this response. */
  operationId: string;
  /** Confirms that the server accepted the mutation. */
  outcome: "Accepted";
  /** Resources changed by the mutation; related cached projections may need refreshing. */
  affectedResources: AffectedResourceDto[];
};

/** Identifies the original operation when looking up its durable server receipt. */
export type GetOperationRequestParams = {
  /** Original client-generated operation ID, not the resource ID. */
  operationId: string;
  /** Generation originally stored with the operation, even if the current server generation differs. */
  environmentGeneration: string;
};

/** Receipt lookup result. Replayed payloads describe the original outcome, not current resource data. */
export type GetOperationResponse = {
  /** ID of the operation whose receipt was requested. */
  operationId: string;
  /** Server outcome: `Accepted`, `Rejected`, or `Unknown`. Unknown does not prove nonexecution. */
  outcome: string;
  /** Original mutation's HTTP status, or null when no receipt is available. */
  httpStatus: number | null;
  /** Original success payload or rejection Problem Details; absent receipt data is null. */
  response: unknown;
  /** Version of the stored response format, or null without a receipt; check before decoding. */
  responseSchemaVersion: number | null;
};

/** Transport for recovering mutation outcomes from the server's operation receipts. */
export interface IOperationsApi {
  /** Fetches a receipt under current authorization; Unknown must not be treated as cancellation. */
  getOperation(
    params: GetOperationRequestParams,
    signal?: AbortSignal,
  ): Promise<GetOperationResponse>;
}

/**
 * Persisted lifecycle, independent of connectivity or dependency-derived UI labels.
 * - Queued: durable intention, not yet dispatched.
 * - Dispatched: request frozen; in flight or uncertain, requiring reconciliation/identical replay.
 * - Accepted: final server success persisted locally.
 * - Rejected: final server business/validation rejection persisted locally.
 * - Cancelled: proven-unsent intention cancelled locally, not a server resource deletion.
 * A dependent blocked by rejection stays Queued; it was not itself server-rejected.
 */
export type OperationState = "Queued" | "Dispatched" | "Accepted" | "Rejected" | "Cancelled";
/**
 * Retention policy, not current connectivity. Immediate actions are removed after a definitive
 * outcome when unreferenced; Queued actions retain progress/results. Uncertain immediate actions
 * move to Queued recovery, and queued actions remain retained when executed online.
 */
export type ExecutionMode = "Immediate" | "Queued";

/**
 * Durable SQLite journal row. JSON fields are serialized text; nullable timestamps use ISO strings.
 * Keep server outcomes separate from editable local forms and dependency-derived waiting states.
 */
export type JournalOperation = {
  /** SQLite-assigned monotonic insertion order; schedules eligible work and orders the progress UI. */
  sequence: number;
  /** Client operation UUIDv7, also sent as operationId; distinct from resourceId. */
  id: string;
  /** Server generation captured at enqueue time; a mismatch blocks replay without changing this value. */
  environmentGeneration: string;
  /** Stable feature-dictionary key, for example `UpdateProfileInformation`; also identifies the UI action. */
  command: string;
  /** Primary target kind, used with resourceId for conflict checks and UI grouping. */
  resourceType: string;
  /** Primary target ID; creates use the client-generated resource ID before it exists on the server. */
  resourceId: string;
  /** Determines whether a definitive result is removed or retained as queued history. */
  executionMode: ExecutionMode;
  /** Serialized submitted business input, separate from later edits and the final transport body. */
  intentJson: string;
  /** Local intent format version, allowing future handlers/migrations to identify stored payloads. */
  payloadSchemaVersion: number;
  /** Serialized request envelope ({ body }); null until first dispatch, immutable once dispatched. */
  frozenRequestJson: string | null;
  /** Persisted lifecycle; waiting/blocked labels are derived from dependencies instead. */
  state: OperationState;
  /** Dispatch/recovery cycles started; may include receipt lookups rather than mutation resends. */
  attemptCount: number;
  /** Earliest automatic retry time; null means no backoff, not necessarily ready to execute. */
  nextAttemptAt: string | null;
  /** Time dispatch was first durably recorded, before transport; null means never dispatched. */
  firstDispatchedAt: string | null;
  /** Most recent recorded dispatch/recovery start time. */
  lastAttemptAt: string | null;
  /** Automatic-replay gate, such as AuthenticationRequired or EnvironmentGenerationMismatch; null if ungated. */
  replayBlockCode: string | null;
  /** UI failure classification, such as Validation, Business, Transport, Authentication, or Recovery. */
  errorCategory: string | null;
  /** Stable server Problem Details code when available; supports failure-specific UI/actions. */
  errorCode: string | null;
  /** Human-readable failure summary; validation field messages live in errorDetailsJson. */
  errorMessage: string | null;
  /** Serialized failure details, including validation.fields keyed by form paths when supplied. */
  errorDetailsJson: string | null;
  /** Recorded failure or recovered receipt HTTP status; null when unavailable. */
  httpStatus: number | null;
  /** Serialized final success payload or rejection body; null until an outcome is persisted. */
  responseJson: string | null;
  /** Version used to decode the persisted outcome; null before a final response is saved. */
  responseSchemaVersion: number | null;
  /** Rejected operation explicitly superseded by this new intention; preserves correction history. */
  replacesOperationId: string | null;
  /** Time the user cleared the item from the active list; the historical row remains stored. */
  dismissedAt: string | null;
  /** Time the intention was first persisted. */
  createdAt: string;
  /** Time the journal row was last changed, not the server resource's updatedAt. */
  updatedAt: string;
};

/** Journal row enriched with dependency information for progress/failure displays. */
export type OperationListItem = JournalOperation & {
  /** Earliest direct prerequisite not Accepted; null if no direct prerequisite is waiting. */
  waitingOnOperationId: string | null;
  /** Earliest rejected, cancelled, or replay-gated ancestor; null if no such ancestor exists. */
  blockedByOperationId: string | null;
};

/** Additional resource scope used to detect conflicting pending work across commands. */
export type OperationResource = {
  /** Resource kind participating in this operation's conflict checks. */
  resourceType: string;
  /** ID of that resource, including client-generated IDs for pending creates. */
  resourceId: string;
  /** Write conflicts with reads/writes; Read conflicts with writes. This is not an authorization grant. */
  accessMode: "Read" | "Write";
};

/** Raw repository insertion shape. Feature callers use the typed EnqueueCommand contract instead. */
export type EnqueueOperation = {
  /** Stable key of the statically composed feature handler for this command. */
  command: string;
  /** Primary resource kind; automatically registered as a Write scope. */
  resourceType: string;
  /** Primary resource ID used for ordering/dependency and conflict checks. */
  resourceId: string;
  /** Validated business input; do not derive retries from a mutable form after enqueueing. */
  intent: Record<string, unknown>;
  /** Immediate for a direct online action; Queued for durable work whose results should remain visible. */
  executionMode: ExecutionMode;
  /** Explicit earlier operation IDs that must be Accepted; conflicting pending work adds dependencies too. */
  dependsOn?: string[];
  /** Immutable valid form snapshots to link to this operation in the insertion transaction. */
  snapshotIds?: string[];
  /** Extra resource scopes beyond the primary Write target, for cross-resource conflict checks. */
  resources?: OperationResource[];
  /** Rejected operation on the same resource to supersede; cancels its unsent descendants atomically. */
  replacesOperationId?: string;
};

/** Minimum successful response contract shared by command handlers; feature payloads add their own fields. */
export type JournalResponse = {
  /** ID of the acknowledged operation; must match the journal row being finalized. */
  operationId: string;
  /** Final server success, not merely successful local enqueueing. */
  outcome: "Accepted";
  /** Changed resource versions used for dependent requests and cache repair. */
  affectedResources: AffectedResourceDto[];
};

/**
 * Action/processing result. Pending means no accepted result was returned, not necessarily Queued:
 * inspect the journal for waiting, uncertain, rejected, or blocked work. Direct receipted online
 * rejections are thrown to the feature caller instead of returned here.
 */
export type OperationResult<T = JournalResponse> =
  | {
      /** Server success and local result persistence completed. */
      status: "Accepted";
      /** Acknowledged operation ID; its immediate journal row may already have been removed. */
      operationId: string;
      /** Accepted response payload, including feature-specific fields. */
      data: T;
    }
  | {
      /** No accepted payload returned; use the journal to show the actual progress/failure state. */
      status: "Pending";
      /** ID used to find the durable operation and its dependencies/outcome. */
      operationId: string;
    };
