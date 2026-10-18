# Applications and reviews

Session services expose `applications` for reads/applicant editing and
`applicationReviews` for manager mutations and private notes. Both use the shared
operation journal. Hooks live in each feature's `hooks.ts`.

## Applicant editor

1. `startDraft(unitId)` returns a durable editor with a client application ID.
   Only the login email is prefilled. `openEditor(id)` resumes an existing editor
   or initializes one from a complete downloaded Draft/Returned application.
2. `saveDraft(id, input, step?)` saves unfinished input, including invalid values.
   It never creates a business operation. Back navigation and residence modal
   changes use this local path. `copyProfileSection` also changes only local input
   and requires explicit replacement confirmation.
3. `continueApplicantInformation(id)` validates the first section and creates the
   server Draft on the first Continue. Subsequent Continues replace that section.
   `continueResidenceHistory(id)` saves the whole history, including an empty list.
4. `getSummary(id)` returns the latest Continue snapshots, unfinished-edit status,
   and whether both snapshots are server accepted. Unsent, rejected, and accepted
   snapshots remain distinct. Offline Submit depends on deliverable section saves;
   online Submit requires both accepted snapshots.
5. Pass the editor's exact `baseVersion` to Submit, or the viewed application's
   exact version to Withdraw. Never replace an edited version with a newer GET.
   A rejected operation can be explicitly corrected with `replacesOperationId`.

`discardLocalDraft(id, true)` cancels proven-unsent creation chains and removes
their local input. Dispatched creation must first be reconciled. Server-linked
applications are withdrawn, never deleted. `closeEditor(id, true)` discards only
server-linked local editor input after pending work is resolved; this also frees
the per-unit editor slot after a terminal application.

## Storage and reads

Repositories normalize accepted summaries/details, residences, history, leases,
and account-author-scoped notes. Local forms and immutable Continue snapshots are
separate from accepted data. Details report `isOutdated` when newer summaries or
compact operation effects are known; summaries never replace complete details.
Private notes have an independent version and do not lock application actions.

Read results include `source: "server" | "device"` and optional `fallbackError`.
Device lists contain only downloaded rows; local-only drafts are listed separately.
UI consumers must label offline subsets and outdated details appropriately.
Owner authorization and inventory availability are ultimately enforced by the API,
including for actions queued while offline.

Bulk rejection stores no client application selection or expected versions. Its
compact acknowledgement marks affected details outdated through the journal;
it does not synthesize Denied application details or change unit availability.

`useSyncApplications()` runs an explicit shared-queue processing pass and refreshes
queries. These features do not install an automatic reconnect/background worker.

The repository/service tests use Node's in-memory `node:sqlite` (Node 22.13+)
to exercise the actual migrations, foreign keys, and operation transactions.
