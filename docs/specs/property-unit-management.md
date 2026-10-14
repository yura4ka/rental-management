# Property and unit management

## Product requirements

### User stories
- As a manager, I can list my properties and their units, and create, edit, or archive them.
- As an applicant, I can browse available units before starting an application.

### Business rules
- A property's creator is its sole manager owner. Only that owner may maintain it and its units; maintenance uses modals.
- Property address: optional Display Name (marketing name), required Street Address, optional Line 2. Display joins nonblank components with comma-space.
- Unit fields: number, type, bedrooms, and monthly USD rent. Number is 1–20 characters of `A–Z`, `0–9`, `_`, or `-`, unique within the property including archived units. Reject invalid input rather than normalizing it.
- Bedrooms are nonnegative integers; rent is positive with at most two decimal places. Types are lookup values, not free text. An existing inactive type may remain unchanged but cannot be newly assigned.
- Archive replaces deletion. Archiving a property also archives its active units; archived inventory cannot be edited, restored, or receive new units.
- Available units have active property/unit records and no lease covering server UTC today. Managers may also browse them read-only.
- Archived inventory is excluded from new applications, but existing applications and leases retain their normal workflows and linked inventory access.

## Technical essentials

### Models
| Model | Essential fields / relationships |
| --- | --- |
| `Properties` | ID, owner manager ID, address, `ArchivedAt`, timestamps, `Version`. |
| `Units` | ID, property ID, type ID, number, bedrooms, monthly rent, `ArchivedAt`, timestamps, `Version`. |
| `UnitTypes` | ID, code, name, `IsActive`, `Version`. |
| `UnitLeaseGuards` | Unit ID, confirmed exclusive lease end, independent `Version`; created with the unit. |

- Address limits: Display Name 100, Street Address 200, Line 2 100. Store independent address components, not formatted text or shared address rows.
- Archive state is nullable `ArchivedAt`, not a stored boolean. Enforce unique `(PropertyId, Number)` using binary equality.
- Wire/client rent is integer `monthlyRentCents`; SQL stores USD `decimal(12,2)`. Do not use floating-point money.
- Each mutable resource has one incrementing bigint `Version`, exposed as a decimal string. Maintenance uses the [shared command protocol](offline-mode.md#command-contract).
- Inventory writes check the active owned parent transactionally. Property archival is atomic and retains applications/leases.

### API direction
| Route / operation | Purpose |
| --- | --- |
| `/api/properties` | Create properties and list the requesting manager's properties. |
| `/api/properties/{id}/units` | Create units and list units under an owned property. |
| Property/unit edit routes | Update owned active inventory; exact paths/methods remain undefined. |
| `POST …/{id}/archive` | Archive property or unit, never `DELETE`. |
| `GET /api/available-units` | Available property/unit summaries; availability is rechecked when creating an application. |
| `GET /api/unit-types` | Lookup types, including inactive values needed for existing assignments. |

