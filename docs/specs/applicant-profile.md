# Applicant profile

## Product requirements

### User stories
- As an applicant, I can view and edit reusable contact information and previous residences.
- As an applicant, I can explicitly copy either profile section into an editable application to avoid re-entering details.

### Business rules
- Only the applicant can access their profile; managers cannot access it through application viewing.
- Contact information contains name, phone, contact email, and current address. It may be incomplete, but supplied values must be valid. Contact email is independent of login email.
- Previous residency may be empty. Every added residence requires street address, landlord name/phone, and move-in/move-out dates. Move-in precedes move-out; neither date is future.
- Copying a section fills local application input only. Confirm replacement when input already exists; normal Continue validation/save is still required.
- Profile and application values are independent snapshots: changes never automatically update each other.
- Previously downloaded profile data is available offline for viewing/copying; valid saves queue for sync. Unfinished input remains separate from server saves.

## Technical essentials

### Models and validation
| Model | Essential fields |
| --- | --- |
| `ApplicantProfiles` | Applicant ID, optional name/phone/contact email/current address, timestamps, shared `Version`. |
| `ProfileResidences` | Applicant ID, input position, address, landlord name/phone, move-in/move-out dates. |

- Signup creates an empty profile at Version 1. Both sections share its bigint Version; residence replacement advances it atomically.
- Address: optional Display Name (100), Street Address (200), optional Line 2 (100). Profile current Street Address may be omitted; residence Street Address is required.
- Names: maximum 100; email: maximum 254 and valid syntax; phones: exact `NNN-NNN-NNNN` (input ceiling 50).
- Store blank optional profile values as NULL. Validate on client and server.
- Residence keys are `(ApplicantId, Position)`; replace the whole ordered section, including an empty list. Display by move-in date, move-out date, then position, ascending.
- SQL calendar fields use `date`; wire calendar values use UTC-midnight `YYYY-MM-DDT00:00:00Z`, without device-timezone conversion.

### API
| Route / operation | Contract |
| --- | --- |
| Profile read | Own contact information and residences; exact GET route/DTO remains undefined. |
| `PUT /api/me/profile/applicant-information` | Replace the contact section; incomplete but valid supplied values allowed. |
| `PUT /api/me/profile/residence-history` | Replace the whole valid ordered residence list, including empty. |

- Saves use the [shared command protocol](offline-mode.md#command-contract), including profile `expectedVersion` as a decimal string.
- There are no granular residence or server-copy endpoints. Copying is a local form operation.
