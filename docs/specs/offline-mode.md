# Application offline mode

## Product requirements

### User stories
- As a returning user, I can view downloaded data and continue local work without connectivity.
- As a user, I can queue valid business actions and see their sync status and failures.
- As a user, I can sign out without accidentally losing unsynced work.

### Sign-out guards
- Sign out is online-only. Warn about queued work and all unsynced input, including local drafts, unfinished application edits, and profile edits.
- Offer Sync first / confirmed Discard pending work and local edits and sign out / Cancel. Sync first does not implicitly Continue/save unfinished input; remaining input still requires loss confirmation.
- Never delete private work before server acknowledgement. A confirmed logout failure retains the session/work; an uncertain outcome blocks business replay until reconciliation.
- Exception for an explicitly initiated logout with required discard confirmation: persist its operation ID outside the account database, attempt logout, and use normal token refresh after access-token expiry. Successful refresh retries the same logout ID. Refresh 401 or known refresh-token expiry permits verified local cleanup without same-account sign-in, even without acknowledgement. This confirms local sign-out only, not server revocation. Network/transient refresh failures do not authorize cleanup. Ordinary session expiry without a pending explicit logout still preserves work.
- After acknowledgement, clear private memory, delete account database/sidecars, remove keys/tokens, and verify removal before reporting success.
- Interrupted/failed cleanup remains **Cleanup incomplete**, with Retry and private access/replay blocked across restart.
- Session expiry is not logout: preserve data/input/queue and allow existing-user offline access; replay requires valid same-account authentication. Never expose retained work to another account.

### Data persistence and offline reads
- Automatically persist unfinished/invalid application input. Keep local input, valid save snapshots, queued intentions, and server-accepted data separate.
- Clearly label **On device**, **Pending sync**, and **Saved to server**; persist pending work and failure feedback across restart.
- Offline filtering, sorting, and paging operate on downloaded records, even when that exact query/page was never loaded online. Label **showing offline data** and **Only previously downloaded records are included**; empty matches say **No matching downloaded records**.
- Complete downloaded details are available by resource ID. Without complete coverage, show **Unavailable offline**. Summaries/compact acknowledgements do not count as full details.
- Preserve older complete snapshots with an outdated-details warning when newer summaries/related resources exist; never splice partial fields into them.
- First use without cached session/data requires connectivity. Device loss/reinstall may lose unsynced work; private data is excluded from backup/transfer.

### Operations queue and sync
- Queue all valid business mutations: inventory, profile, application sections/actions, and notes. Auth is excluded.
- Respect dependencies: application create → section saves → Submit; Start Review → outcome. Pending Submit/Withdraw/review outcomes lock conflicting edits/actions.
- Reconnect automatically replays eligible work. Show offline status, pending count, waiting work, and durable failures distinctly.
- Rejections preserve input and pause dependents; unrelated work continues. Stale changes require reload and explicit reapplication, never automatic overwrite.
- Confirmed unsent queue discard cancels dependents but preserves input. Local-draft discard separately confirms input deletion. Dispatched or accepted actions cannot be claimed cancelled.

## Technical essentials

### Architecture and storage
- React Native/TypeScript on iOS/Android; TanStack Form for forms. TanStack Query owns reads/mutation execution; NetInfo drives connectivity. Zustand owns session/UI/local input, not copied server records.
- Account/API-bound SQLCipher databases store downloaded summaries/full snapshots, local input, valid snapshots, journal/dependencies, and recovery feedback. SecureStore holds random database keys and a separate token-pair envelope. Expo development builds are required.
- Bind storage/credentials to installation/account/API/database generation. Separate Query clients and late-response guards prevent cross-account access.
- One serialized keyed SQLite writer commits durable changes; no network inside local transactions. Load pages/details/payloads lazily, not the entire store at startup.
- Persist nonsecret logout controls outside the account database so they survive deletion/restart. Unreadable storage blocks dependent access/replay while preserving files; no silent reset or plaintext fallback.

### Persistence and sync flow
1. Online read → API → authorized SQLite snapshot update → Query result. Offline read → SQLite subset query → labeled Query result.
2. Valid business intent → atomic local snapshot/journal/dependency commit → Pending sync. Unfinished input alone never implies a server save.
3. Coordinator checks connectivity, same-account auth, storage, logout, server generation, dependencies, and retry timing; freezes request and records Dispatched before transport.
4. Execute through Query. Persist final outcome and projection-repair metadata before releasing dependents; invalidate/refetch affected reads. Compact acknowledgements do not make old details fresh.
5. Reconcile uncertain outcomes using an actual receipt fetch or identical original-request replay. Rebuild eligible attempts from the journal on restart; no second persisted Query mutation queue.

### Command contract
- REST JSON/OpenAPI with server authorization and validation. Business mutations carry UUIDv7 `operationId` and `environmentGeneration`; existing targets also carry decimal-string `expectedVersion` (first note save uses null).
- Inventory/application creates accept client-generated UUIDv7 `id`. Reject all is an explicit version-check exception: it selects all open applications at execution time, including applications created or edited after enqueueing, and carries no expected versions.
- Mutable resources use one bigint Version starting at 1, incremented transactionally. Never convert versions through JavaScript Number or automatically rebase stale work.
- Immutable account-scoped `OperationReceipts` commit with business effects. Identical replay returns the original outcome; changed intent under the same ID conflicts.
- `GET /api/operations/{operationId}` returns Accepted/Rejected with the original outcome, or Unknown. Unknown never proves nonexecution/cancellation. Generation mismatch blocks replay and preserves work.
- Recovery requires the original `environmentGeneration` query parameter. Success is 200 `{ operationId, outcome, httpStatus, response, responseSchemaVersion }`, where response is the original body; Unknown has no original response. Same-account access and current resource authorization are checked before returning historical outcomes.
- Custom errors use Problem Details with stable `code`; validation uses `validation.fields` keyed by form paths. Authorized final 409/422 outcomes record rejection receipts; transport/transient failures remain pending/uncertain, 401 gates authentication, and non-receipted 400/403/404 block automatic replay pending explicit recovery.
- `OperationIdConflict` and `EnvironmentGenerationMismatch` are non-receipted protocol 409 errors, not rejection receipts. Never replace the original operation's receipt. Mutation successes retain their existing response fields and add `{ operationId, outcome: "Accepted", affectedResources }`; affected-resource entries contain resourceType, canonical id, and decimal-string version (null for unversioned resources). Metadata alone is not a complete detail snapshot, and original replayed snapshots must not supersede newer downloaded versions.

### Environment generation
- `/api/auth/me` exposes the database's opaque GUID generation. Bind local data and frozen commands to it; check on reconnect and send it on every business command/recovery. The server checks it independently before execution/replay.
- On mismatch, block business replay, retain local work, download current server data into a separate generation-bound store, and require explicit recovery/reapplication. Never rewrite old queued commands to use the new generation automatically.
- Preserve the generation across deployments, migrations, and normal restarts. Reset/replacement, cloning into another API environment, or restoration that invalidates sync history requires rotating it before serving requests. Restoring the old generation from a backup without rotation does not provide protection.

### Journal and scheduling
| State | Meaning |
| --- | --- |
| Queued | Durably recorded, not dispatched; may be discarded while proven unsent. |
| Dispatched | Frozen request in flight or uncertain; reconcile/retry identically. |
| Accepted | Final success stored locally; cannot cancel. |
| Rejected | Final business rejection; preserve input and block dependents. |
| Cancelled | Unsent intention cancelled; input remains unless separately discarded. |

- One coordinator, at most two independent attempts in flight, one per shared mutable aggregate. Query automatic mutation retries are disabled; coordinator owns durable backoff.
- Replay occurs while active/on reconnect/foreground return; execution while OS-suspended or terminated is not promised. Retry transient attempts with jittered exponential backoff capped at 60 seconds, honoring longer Retry-After; transport deadline is 30 seconds.
- Read fallback is permitted for transport failures/502/503/504 only, with failure context, cached-data labels, and Retry. Never mask 500/auth/authorization/validation errors as cached success.
