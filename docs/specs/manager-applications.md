# Manager application management

## Product requirements

### User stories
- As a manager, I can list and view applications, including those for other managers' properties.
- As the property owner, I can start/release review, return, deny, or approve an application.
- As a manager, I can maintain my own private note on any application.

### Business rules
- All managers can view application details/history/lease dates; only the linked property's owner can perform review actions. Managers cannot edit applicant sections.
- Opening an application never changes its status. Review outcomes use a modal.
- The list supports status/property filters and creation/status-change sorting, 20 rows/page, newest-created first.
- Show archived defaults off; enabling it includes archived-linked applications and archived property filter options. Existing archived-linked applications still support normal review actions.
- Approval issues a twelve-month lease. An active lease prevents approval; other open applications remain unchanged. Terminal outcomes cannot transition further.
- Each manager has at most one private note per application, editable at any status. Only its author receives it; clearing to empty is allowed. Notes are not review comments/history.

### Review actions
| Action | Transition | Comment |
| --- | --- | --- |
| Start review | `Submitted` → `InReview` | None required |
| Release | `InReview` → `Submitted` | None required |
| Return | `InReview` → `Returned` | Required |
| Deny | `InReview` → `Denied` | Required |
| Approve | `InReview` → `Approved` | Optional |

Review comments and private notes have a 2,000-character limit. Return/Deny comments must be nonblank.

## Technical essentials

### API
| Route | Contract |
| --- | --- |
| `GET /api/applications` | Authorized rows/filtered total; `page`, `status`, `propertyId`, `showArchived`, `sortBy=createdAt|statusChangedAt`, `sortDirection=asc|desc`. |
| `POST /api/applications/{id}/{action}` | Separate `start-review`, `release`, `return`, `deny`, `approve` endpoints; application `expectedVersion` and comment where applicable. |
| `PUT /api/applications/{id}/my-note` | Own note body; independent note `expectedVersion`, explicitly null for first save. |

- All writes follow the [shared command protocol](offline-mode.md#command-contract). Online list filtering/paging/sorting runs in SQL; canonical UUID text ascending is the timestamp tie-breaker.
- Application detail embeds only the requesting manager's own note; no separate note GET or list-note projection is selected.

### Models and integrity
- Review actions conditionally update `RentalApplications` using its shared Version and append `ApplicationStatusHistory` atomically with the operation receipt. Stale competing actions cannot both succeed.
- `ManagerNotes`: composite key `(ApplicationId, AuthorManagerId)`, body, timestamps, independent Version. Clearing updates the existing row; no note-edit history.
- `Leases`: ID, unique ApplicationId, StartDate, EndDateExclusive, ApprovedAt. Unit identity is derived through the application; leases are immutable in scope.
- Approval atomically commits Approved status, lease, history, receipt, and the per-unit lease guard end. The guard prevents competing applications from issuing overlapping leases.
- Capture server UTC time after the guard write lock; start is that UTC date and exclusive end is `AddMonths(12)`. Offline queue time is not the lease start; pending approval is not an issued lease.

## Online implementation amendments

These business/response amendments remain in effect alongside the shared [offline command protocol](offline-mode.md#command-contract).

- Review actions require operationId/environmentGeneration, decimal-string application `expectedVersion`, and atomic status/history/receipt updates. Approval also atomically commits the lease and unit lease guard. Offline queues and pending-action UI locks remain client responsibilities.
- Approval does **not** automatically deny or otherwise change other applications for the unit.
- Existing applications retain normal actions after property/unit archival, including approval. Creation requires active inventory; submit/resubmit requires no active lease but ignores archival.

### Additional endpoints

| Route | Contract |
| --- | --- |
| `GET /api/applications/{id}` | Any manager may view detail/history/lease dates, including archived-linked applications. Embeds only that requesting manager's own note, or null. See applicant amendments for detail/list shapes. |
| `POST /api/units/{unitId}/applications/reject-all` | Property owner only, including archived units. Body `{ operationId, environmentGeneration, comment }`: required nonblank comment, maximum 2,000 characters. Returns `200` with affectedCount and operation/affected-resource metadata. |

### Bulk rejection

- Explicit action independent of approval; no automatic bulk rejection occurs.
- Atomically transitions all applications in `Draft`, `Submitted`, `InReview`, or `Returned` for the unit to `Denied`, evaluated at execution time after acquiring the unit guard. Terminal applications and leases remain unchanged.
- Unlike the single-application `deny` endpoint, bulk rejection may deny any open status. A never-saved residence history remains null when a Draft is denied.
- Each affected application advances its shared Version and receives an individual `Deny` history entry with actor, prior/new statuses, server time, and the shared comment. Applicant information and residences are unchanged.
- No client application list or expected versions are required. Creation and lifecycle actions serialize on the same per-unit guard; application row locks coordinate section saves. Concurrent creation is ordered either before the batch (included) or after it (not included). The batch is all-or-nothing.
- This is an explicit version-check exception for offline queues: newly created/edited applications may be included when first executed. Identical replay returns the original batch result without selecting or rejecting additional applications. Each affected history row uses the batch operation ID; history, effects, and its account-scoped receipt commit together.
- No matching applications is a successful no-op with `affectedCount: 0`. Unowned units return `403`; nonexistent units return `404`.

### Existing write response contracts

- Review requests contain `{ expectedVersion, comment? }`; Return/Deny require a nonblank comment, Approve allows one, and Start review/Release accept no nonblank comment. Successful review actions return updated application detail.
- `PUT /api/applications/{id}/my-note` accepts `{ expectedVersion, body }`. The expected version property must be present: explicitly null on first save, otherwise the decimal-string note Version. Body must be supplied and may be empty, with a 2,000-character limit. Returns `{ body, createdAt, updatedAt, version }`. Note writes never advance the application Version or create review history.
- List filtering/paging/sorting and UUID tie-breaking follow the original contract; list rows never project notes. `showArchived` affects list inclusion only, not detail access or review permissions.
- All write bodies above additionally require operationId/environmentGeneration, and successful bodies add operationId, outcome, and affectedResources. First note saves still require an explicitly null expectedVersion; note operations have their own receipt but never advance the application Version.
