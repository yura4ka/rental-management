# Auth

## Product requirements

### User stories
- As a new user, I can sign up as an Applicant or Property Manager.
- As a registered user, I can sign in, stay authenticated through refresh, and sign out safely.

### Business rules
- Sign up, sign in, refresh, and sign out require connectivity; authentication actions are not business-queue operations.
- Each account has exactly one role. Manager self-selection is an assessment convenience, not production-safe role provisioning.
- Sign up uses a unique email and password; it does not automatically sign in.
- Access tokens last 15 minutes; refresh tokens last 14 days. Sign out revokes existing refresh capability account-wide, but issued access tokens remain usable until expiry.
- Session expiry preserves downloaded data and local work. Sync waits for valid authentication to the same account.
- Sign-out warnings, reconciliation, and cleanup follow [Offline mode](offline-mode.md#sign-out-guards).

## Technical essentials

### Architecture and models
- ASP.NET Core Identity with standard opaque Bearer tokens, not a custom session/token store. Protected API calls require Bearer authentication and server-enforced role/resource authorization.
- One EF Core `IdentityDbContext` and SQL Server migration stream for Identity and business data.
- Signup atomically creates the user, one role, and an empty `ApplicantProfiles` row for applicants only.
- Trim email consistently for signup/login; retain Identity normalization and database-enforced normalized-email uniqueness.
- Password: 12–128 UTF-16 code units, not whitespace-only; no trimming or composition requirements.
- Store the access/refresh pair together in SecureStore, outside Query/SQLite. Refresh is single-flight; activate credentials only after secure persistence succeeds.
- Persist server Data Protection keys across API restarts. Disable cookie login and unapproved built-in account routes.

### API
| Route | Contract |
| --- | --- |
| `POST /api/auth/signup` | Email, password, role (`Applicant` or `PropertyManager`); returns account ID/email/role without tokens. |
| `POST /api/auth/login` | Standard Identity Bearer login; no cookie query flags. |
| `POST /api/auth/refresh` | Standard Identity refresh protocol. |
| `GET /api/auth/me` | Authenticated account ID/email/role and database `environmentGeneration`. |
| `POST /api/auth/logout` | `{operationId}`; 200 `{operationId, outcome: "Accepted", acknowledgedAt}`. |
| `GET /api/auth/logout/{operationId}` | Original Accepted acknowledgement or `{operationId, outcome: "Unknown"}`. |

- Login/refresh success uses `tokenType`, `accessToken`, `expiresIn`, `refreshToken`; handle their native failure responses without relying on message text.
- Logout atomically updates the Identity security stamp and records `LogoutAcknowledgements(AccountId, OperationId, AcknowledgedAt)`. Repeating the same acknowledged operation must not revoke a later login.
- Logout acknowledgements are retained indefinitely. Recovery is scoped to the authenticated account and returns Accepted or Unknown; logout remains outside the business command queue.
- The client persists its UUIDv7 logout operation ID outside the private account database before transport. An unexpired access token can retry/fetch the acknowledgement even after successful refresh revocation. After access-token expiry, attempt normal refresh; successful refresh retries the same logout ID. A refresh 401 or known refresh expiry permits verified local cleanup without sign-in and without confirmed server revocation, only for a pending explicit logout with the required discard confirmation. Transient refresh errors retain pending logout/work. Normal session expiry is not logout.
