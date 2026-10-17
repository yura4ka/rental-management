---
name: mobile-operations
description: Implement or review mobile feature services, normalized SQLite repositories, typed operation commands, offline queues, and TanStack Query hooks in rental-management. Use when adding a journal-backed mutation or changing operation replay, dependencies, recovery, or cache invalidation.
---

# Mobile operations and feature implementation

This is a repository-specific workflow, not a generic queue framework. Follow the existing typed feature dictionaries and preserve persisted command compatibility.

All code paths below are relative to the repository root. From this skill's directory, the repository root is `../../..`.

## Read before changing code

1. Read `mobile/AGENTS.md` and any applicable instructions. Follow its Expo documentation requirements before touching native APIs.
2. Read `docs/specs/offline-mode.md` and the target feature's specification. Specs describe product requirements; do not assume every requirement is already implemented.
3. Read the reference implementation:
   - `mobile/src/features/applicantProfile/applicantProfileService.ts`
   - `mobile/src/features/applicantProfile/applicantProfileRepository.ts`
   - `mobile/src/features/applicantProfile/operations/{types,schemas,handlers}.ts`
   - `mobile/src/features/applicantProfile/queryKeys.ts` and `hooks/`
4. Read `mobile/src/features/operations/{commandCatalog,commands,operationsService,operationsRepository,types}.ts`, its `README.md`, and `mobile/src/services/session/createServices.ts`.
5. Inspect the actual response/request types and existing migrations. Do not invent API fields or reinterpret existing queued payloads.

## Ownership and dependency direction

```text
UI / TanStack Query hooks
  → feature service
      → feature API / repository for reads
      → OperationsService.perform() for business mutations

OperationsService
  → OperationsRepository: journal SQL, dependencies, ordering
  → CommandCatalog: runtime decoding and bound feature handlers
      → feature API: execute request
      → feature repository: persist accepted response inside supplied transaction
```

- Feature services validate business input, manage feature-specific snapshots, and orchestrate reads/actions.
- API classes own HTTP routes and verbs. Do not duplicate endpoints in handler dictionaries or hooks.
- Feature repositories own normalized accepted data and local forms; they do not schedule or replay operations.
- `OperationsService` owns delivery policy, request freezing, retries, recovery, and journal state.
- Compose typed handler dictionaries once in `createServices()`. Do not introduce `.register()`, mutable global registries, large command switches, or constructor registration side effects.
- Never call a feature's public mutation method from queued execution: it would enqueue another operation.
- Zustand owns session/UI/local input, not copied server records. Query holds read results; SQLite is durable storage. Do not add a second persisted TanStack mutation queue.

## Four distinct data layers

1. **Local form input:** may be incomplete/invalid and changes while typing. Saving a draft does not enqueue a command.
2. **Valid form snapshot:** immutable input explicitly submitted/continued by the user.
3. **Journal intention/frozen request:** durable command and its dependencies; frozen request is reused unchanged after dispatch.
4. **Accepted server snapshot:** normalized GET/mutation data, protected from older receipt versions.

Do not update accepted cache optimistically with queued input. Do not rebuild a retry from current form state. Never convert decimal-string resource versions through JavaScript Number; use exact string preservation and BigInt comparisons when needed.

## Delivery modes and states

`executionMode` is retention policy, not current connectivity:

- **Immediate:** a direct online action. Atomically refuse insertion if conflicting unresolved work exists on its resource. Persist before sending. Remove a definitive accepted/rejected operation only when unreferenced. Throw a definitive direct rejection to the form, while preserving input.
- **Queued:** an offline intention or retained recovery attempt. Multiple offline submissions on the same resource are allowed. Keep responses/results so users can inspect progress/history. Queued work remains retained when executed online.
- An immediate request with an uncertain outcome becomes retained queued recovery work.

Journal lifecycle:

| State      | Meaning                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| Queued     | Durable intention, not dispatched. Dependencies/backoff may prevent execution. |
| Dispatched | Frozen and recorded before transport; may be in flight or uncertain.           |
| Accepted   | Server success and local result persistence completed.                         |
| Rejected   | Final server business/validation rejection is stored.                          |
| Cancelled  | Proven-unsent intention cancelled locally; not server resource deletion.       |

`OperationResult.status === "Pending"` only means no accepted result was returned. Inspect the journal for actual progress/failure. A TanStack mutation can be `isSuccess` while its operation is still Pending.

### Normal execution

```text
Feature service validates
  → perform()
      → one transaction: journal insertion + valid snapshot + dependencies
      → offline: return Pending
      → online: execute()

processPending() → process() → execute()
  → prepareAttempt(): transaction, validate gates/dependencies, freeze request, mark Dispatched
  → sendOrRecover(): network only
  → finalizeOutcome()
      → accept(): transaction, feature writer + affected resources + Accepted + optional removal
      → reject(): transaction, durable failure + optional immediate removal
      → blockReplay(): preserve unsupported/malformed work for explicit recovery
```

No network calls or Query refetches inside SQLite transactions. Finalization must remain outside the transport catch scope: disk failures after server success must not be reclassified as network failures. Retain uncertain Dispatched work and hold active-operation protection through finalization.

### Dependencies

- Sequence is SQLite insertion order; process FIFO among eligible operations, allowing unrelated work to continue after a chain fails.
- Example: Create Unit → Edit Unit. Offline insertion adds a dependency. Freeze the edit only after creation is accepted, using the predecessor's accepted version.
- Without a predecessor, preserve the version actually edited. Never automatically rebase stale work against an arbitrary latest GET.
- A rejected predecessor blocks its descendants; descendants remain Queued, not Rejected. UI uses `waitingOnOperationId` and `blockedByOperationId`.
- Commands involving multiple resources declare extra Read/Write scopes; this is conflict metadata, not authorization.

### Recovery and correction

- On uncertain retries, fetch the original receipt with the original operation ID and environment generation.
- Accepted/Rejected receipts supply original outcomes, potentially older than current cached resources.
- Unknown does not prove nonexecution. Replay the identical frozen request; never infer safe cancellation.
- Keep `OperationIdConflict` and `EnvironmentGenerationMismatch` distinct from receipted business rejection. Authentication/authorization/protocol failures gate replay as implemented by the coordinator.
- Corrected intent uses a new operation ID. `replacesOperationId` atomically dismisses a rejected operation and cancels its unsent descendants while saving the new intention/snapshot. Preserved dependent input is not automatically resubmitted.
- Clearing unsent/rejected work cancels unsent descendants but preserves forms. Accepted work may be dismissed, not cancelled. Dispatched work must be reconciled before clearing.

## Adding commands for a feature

### 1. Define contracts

Create `features/<feature>/operations/types.ts` with one entry per stable command:

```ts
export type FeatureCommands = {
  UpdateThing: {
    input: UpdateThingInput;
    request: UpdateThingRequestBody;
    response: UpdateThingResponse;
  };
};
```

Requests satisfy `OperationRequestBody`; responses satisfy `JournalResponse`. Form callers do not supply protocol IDs/generation. Use globally unique command names, and never casually rename names already persisted in SQLite.

### 2. Define runtime schemas

Create `operations/schemas.ts` for validated input, prepared request, and accepted response. Reuse protocol shapes in `operations/commandSchemas.ts` where appropriate.

- Strictly validate outgoing command fields; do not silently strip unknown data from frozen requests.
- Validate accepted response structure, not today's form semantics: historical receipts may contain older valid data.
- Preserve exact versions, null/omission distinctions, and array ordering.
- `CommandCatalog` checks the stored payload version, validates JSON, and binds request/response/writer associations. Do not replace it with assertions such as `JSON.parse(...) as Request` in feature code.

### 3. Supply a typed handler dictionary

```ts
export function createFeatureHandlers(
  api: IFeatureApi,
  repository: FeatureRepository,
): CommandHandlers<FeatureCommands> {
  return {
    UpdateThing: {
      resourceType: "Thing",
      inputSchema,
      requestSchema,
      responseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: (request, signal) => api.updateThing(request, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
  };
}
```

Adapt version handling for creates, nullable first-note versions, and explicitly unversioned commands. If the API uses route parameters, capture the necessary values in the frozen command request and adapt them in `execute`; never read later mutable UI state to construct them.

### 4. Compose at startup

Intersect the feature contracts into `features/operations/commands.ts`. Spread the feature dictionary into the `handlers` object in `createServices()` using `satisfies CommandHandlers<Commands>`. Inject that catalog into `OperationsService`, then inject operations into the feature service. No dependency on feature services from the catalog.

### 5. Implement repositories/services

- Append migrations; do not rewrite already applied migrations.
- Normalize server data; tolerate references to resources not downloaded in full. Keep complete details separate from newer list projections when required.
- Replace owned residence/section rows atomically with their header/version.
- Repository writers accept `tx?: IDatabaseQueries`; use the supplied transaction, never start a nested transaction.
- Ignore older server snapshots rather than overwriting newer cached versions with historical receipts.
- Feature service reads online through API → repository → result; offline through repository. Fallback only for transport/502/503/504 errors, not auth/validation/500 failures.
- Feature service mutations call typed `perform()` and save valid snapshots in its insertion transaction.

## Existing limitations to preserve honestly

- `processPending()` is an explicit processing pass, not an installed reconnect/timer/background worker. Do not claim automatic sync unless separately implemented and tested.
- Application editor tables exist, but the full application editor workflow and other feature repositories are not implemented by the profile example.
- Current session invalidation can delete retained work. Preserving work on ordinary authentication expiry remains a separate lifecycle task; do not silently expand a feature change into logout/session redesign.
- Legacy frozen `{ url, method, body }` envelopes remain readable without rewriting. New envelopes store `{ body }`; command identity selects the compatible API adapter. Preserve old adapters or gate incompatible stored commands after API changes.
