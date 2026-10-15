# Applicant application management

## Product requirements

### User stories
- As an applicant, I can start an application for an available unit, save its sections, and submit it.
- As an applicant, I can edit and resubmit a returned application, discard a local draft, or withdraw an open server application.
- As an applicant, I can list my applications and view their status, review history, and issued lease dates.

### Business rules
- One applicant and one unit per application. Only its applicant can edit sections, and only in `Draft` or `Returned`, subject to pending-action locks.
- Editor flow: Applicant Information → Residence History → read-only Summary. Initially prefill login email only; profile copying is explicit.
- Starting/typing creates a local-only form. First valid Continue creates a server Draft (or queues creation offline); no empty server Draft is created.
- Continue validates/saves the current section before advancing online; offline it durably queues a valid save and advances. Back and residence modals only change local input.
- Summary uses the latest valid Continue snapshots. Both sections must be server-accepted before submission, including an explicitly saved empty residence history. Differing unfinished edits block Submit.
- At most one open application (`Draft`, `Submitted`, `InReview`, `Returned`) per applicant/unit; at most one local-only draft per applicant/unit.
- “Remove” means confirmed local-draft discard or confirmed withdrawal of an open server application—not server deletion. Local drafts appear separately from server list totals.
- Applicants retain their own archived-linked applications and normal actions. Approved, Denied, and Withdrawn applications are terminal/read-only.

## Technical essentials

### Models and validation
- `RentalApplications`: ID, applicant ID, unit ID, string status, applicant information, accepted-section timestamps, creation/status-change timestamps, shared bigint `Version`.
- `ApplicationResidences`: independent residence copies keyed by `(ApplicationId, Position)`; whole-section replacement advances application Version atomically.
- `ApplicationStatusHistory`: append-only actor/time/action/status/comment records. Lease dates are read-only; see [Manager applications](manager-applications.md).
- Applicant Information requires name, exact `NNN-NNN-NNNN` phone, valid email, and current address. Name limit 100; email/phone ceilings 254/50.
- Address limits: optional Display Name 100, required Street Address 200, optional Line 2 100. Residence requirements and date ordering match [Profile](applicant-profile.md#models-and-validation).
- Saved-section timestamps distinguish never-saved from saved-empty history. A filtered unique `(ApplicantId, UnitId)` index enforces the open-application limit.
- Create checks active inventory and unit availability transactionally; submit/resubmit checks availability again. Prefer conditional updates over pessimistic locking when possible. Section saves and lifecycle actions use application `expectedVersion` and the [shared command protocol](offline-mode.md#command-contract).

### API
| Route | Purpose |
| --- | --- |
| `POST /api/applications` | Client application ID, unit ID, valid Applicant Information; creates Draft on first Continue. |
| `PUT /api/applications/{id}/applicant-information` | Replace valid Applicant Information. |
| `PUT /api/applications/{id}/residence-history` | Replace valid ordered history, including empty. |
| `POST /api/applications/{id}/submit` | `Draft`/`Returned` → `Submitted`. |
| `POST /api/applications/{id}/withdraw` | Any open status → `Withdrawn`; no reason required. |
| `GET /api/applications` | Own applications only; rows and filtered total. |

- List: 20 rows/page; one-based `page`, `status`, `propertyId`, `sortBy=createdAt|statusChangedAt`, `sortDirection=asc|desc`. Default newest-created first; canonical UUID text ascending breaks ties. No applicant archive toggle.
- Unfinished input survives restart. Discard cancels only unsent draft-creation chains; dispatched/accepted creation must be reconciled, not treated as deleted.

## Online implementation amendments

These amendments take precedence over the offline command references above for the current stage.

- Offline mode and the shared command protocol are deferred: no operation IDs, operation receipts, replay/recovery endpoints, offline queues, or server-side pending-action locks are introduced. Existing-resource writes still require positive decimal-string `expectedVersion` and atomic transactions. A stale write returns `409 StaleVersion`.
- Local forms, unfinished edits, Summary snapshots, and confirmations remain client responsibilities; the API enforces persisted-section completeness, not unsubmitted local input.
- Creation requires active property/unit records and no active lease. Existing applications retain normal actions after either inventory record is archived: submit/resubmit ignores archival but still rejects an active lease.
- Approval leaves all other applications unchanged. While a lease is active, creation, submission/resubmission, and further approval are blocked. Other legal actions remain available.
- The property owner may explicitly deny every open application for a unit, including Draft and Returned; see the manager amendments below.

### Additional endpoint and response contracts

| Route | Contract |
| --- | --- |
| `GET /api/applications/{id}` | Detail accessible to its applicant and all managers, including archived-linked applications. Applicants receive no manager note content. |

- `POST /api/applications` accepts `{ id, unitId, applicantInformation }` with a nonempty client UUID `id`; returns `201`, a detail body, and a Location header. Applicant information uses `name`, `phone`, `contactEmail`, and `currentAddress`.
- Section replacement accepts `{ expectedVersion, applicantInformation }` or `{ expectedVersion, residenceHistory }`. Submit/withdraw accept `{ expectedVersion }`. Successful saves and actions return `200` and updated detail.
- List returns `{ rows, total, page, pageSize }`, with fixed `pageSize: 20`. Each row contains `id`, `applicantId`, `unitId`, `propertyId`, `unitNumber`, `propertyAddress`, `isArchived`, `applicantName`, `status`, `createdAt`, `statusChangedAt`, and decimal-string `version`.
- Detail returns `{ application, applicantInformation, residenceHistory, applicantInformationSavedAt, residenceHistorySavedAt, history, lease, myNote }`; `application` is the list-row shape. History is ordered by ascending sequence and contains actor, action, previous/new statuses, comment, and occurrence time. Applicant `myNote` is always null. `lease` is null until issued, then contains `id`, `startDate`, `endDateExclusive`, and `approvedAt`.
- All calendar dates, including lease dates, use UTC-midnight `YYYY-MM-DDT00:00:00Z`. Statuses/actions use their documented case-sensitive names. Applicant `showArchived=true` is rejected; archived-linked rows are always included for applicants.
