# Backend architecture

## Overview

One ASP.NET Core API and one SQL Server database serve the iOS/Android client. Use a simple layered application, not microservices, a broker, or a distributed workflow engine.

The technology and behavioral choices below summarize the existing specifications. The folder structure is a proposed implementation layout; package/runtime versions remain to be pinned.

## Technologies

| Technology | Purpose |
| --- | --- |
| C# / ASP.NET Core | HTTP API, dependency injection, authorization, and business services. |
| ASP.NET Core Identity | Users, exactly one role per account, password hashing, and opaque Bearer login/refresh. |
| EF Core SQL Server provider | Persistence, code-first migrations, and database-side list queries. |
| SQL Server | Domain records, constraints, optimistic versions, leases, and operation receipts. |
| OpenAPI / Swagger UI | Document and interactively explore the API during development. |
| Docker Compose | Local SQL Server, then API + database integration. |
| Bogus | Deterministic, insert-only demonstration data. |

## Controllers vs Minimal APIs

- **Use controllers for business endpoints**: properties, units, profiles, applications, review actions, notes, and operation recovery.
- Keep controllers thin: parse requests, enforce endpoint authorization, invoke services, and return DTOs. Business rules and transactions belong in services.
- Use the **built-in Identity endpoint mappings** for login/refresh only. Disable the other bundled routes and cookie login; hiding routes from Swagger is not sufficient.
- Apply role policies and resource ownership checks on the server. UI restrictions are not authorization.

## Proposed folder structure

```text
backend/
  RentalManagement.sln
  src/RentalManagement.Api/
    Program.cs
    appsettings.json
    Controllers/           # Business routes and custom auth routes
    Contracts/             # Request/response DTOs, grouped by feature
    Services/              # Feature business logic and transaction orchestration
    Domain/                # Entities, statuses, address value object
    Persistence/
      ApplicationDbContext.cs
      Configurations/      # EF mappings, constraints, indexes
      Migrations/
      Seeding/
    Auth/                  # Identity configuration and endpoint restrictions
    Operations/            # Endpoint command metadata, runner, fingerprints, receipts, recovery
      Authorization/       # Resource-specific operation scope authorizers
    Validation/            # Field/section validators
    Infrastructure/        # Error handling, configuration, startup initialization
  tests/
    RentalManagement.UnitTests/
    RentalManagement.IntegrationTests/
  Dockerfile
compose.yaml
```

Start with one API project and feature-organized classes. Separate projects, generic repositories, CQRS, and mediator libraries are not required by this design.

## Data access and transactions

- Use one scoped `ApplicationDbContext : IdentityDbContext` for Identity and business entities, with one migration stream. Services use EF Core directly.
- Existing-resource writes compare `expectedVersion` and increment the aggregate's bigint Version atomically; JSON versions are decimal strings.
- Online filtering, sorting, pagination, and counts execute in SQL, not after loading all rows into memory.
- The shared `CommandRunner` owns the transaction for HTTP business mutations: reservation, business effects/history/lease, and final receipt commit together. Feature services join the existing transaction without committing or disposing it; standalone service calls open and commit their own transaction when none exists. Final business rejections roll effects back to the runner's savepoint before finalizing the rejection receipt. An unusable transaction rolls back fully and returns a temporary failure; SQL Server MARS must be disabled for savepoint support.

Startup rejects MARS-enabled connection strings. `Operations/CommandFilter` captures original JSON before model binding and delegates to `CommandRunner`, which coordinates generation checks, current authorization, SHA-256 fingerprints, SQL transaction-owned operation locks, reservation-before-effects, savepoint rollback for final 409/422 rejections, and finalize-or-rollback.

## Validation and request transformation

Use FluentValidation with explicit request-to-command mapping for custom endpoints. Register validators as scoped `IValidator<T>` services and invoke `ValidateAsync` inside the application service. Business-command validation runs within the shared receipt transaction so authorized final 422 outcomes can be recovered. Validation remains active for non-controller callers. Do not use FluentValidation's MVC auto-validation integration, DTO validation attributes, or a global string-trimming JSON converter.

## Business command metadata and authorization

### Endpoint declarations

- Each business mutation accepts an `OperationRequest` DTO and declares exactly one method-level `[BusinessCommand]` attribute. Authentication endpoints are outside this protocol. Keep controllers thin; attributes declare command identity and scope, not database authorization logic.
- Declare a stable `CommandType`, typed `ResourceType` target, target `IdSource`, and initial authorization `Scope`/`ScopeId`/`ResourceAccess`. `CommandDescriptor.From` resolves metadata generically rather than selecting rules by controller type or action name. Supported ID sources are the authenticated account, `id`/`propertyId`/`unitId` route arguments, and request `id`/`unitId`. Request sources use `ICreateResourceRequest`/`IUnitTargetRequest`; create IDs still require UUIDv7.
- Optionally declare all three `AcceptedScope`, `AcceptedScopeId`, and `AcceptedAccess` fields; omitting them retains the initial scope. Successful property/unit/application creates use the new resource as their recovery authorization scope. Initial create authorization instead checks the account, parent property, or selected unit, respectively. Rejection receipts retain the initial scope.
- Command names are explicit persisted protocol identities, not names derived from CLR controller/action names. Preserve existing command names and string-serialized resource/access enum names when renaming code; changing them requires a compatibility strategy for stored fingerprints and receipt JSON. These refactors preserve routes, request/response contracts, fingerprints, and existing receipt JSON.
- Missing/duplicate metadata, incomplete declarations, incompatible ID sources, and missing route IDs fail closed as programming/configuration errors. Do not infer a default command or authorization policy.

### Resource handlers

- `OperationAuthorization` validates the required role centrally: `Applicant` access requires the Applicant role; `Manager` and `Owner` access require PropertyManager. It then resolves an `IOperationScopeAuthorizer` by resource type; it does not contain resource-specific queries or a resource-type dispatch switch.
- Register account, property, unit, and application authorizers as scoped services through `ServiceConfiguration.AddOperationAuthorization`. They share the scoped `ApplicationDbContext` with the runner and business services. Each handler declares its resource type, implements `Supports(ResourceAccess)`, validates the supplied scope, and performs current database-backed checks with the supplied cancellation token.

| Scope type | Supported access | Resource checks and denial behavior |
| --- | --- | --- |
| Account | Applicant, Manager | Scope ID must equal the authenticated account and the account must exist; otherwise 404. |
| Property | Owner | Property must belong to the manager; missing or inaccessible properties return 404. |
| Unit | Applicant, Owner | Applicant access requires an existing unit/property; Owner additionally requires property ownership. Existing units requested by a non-owner return 403; missing units return 404. |
| Application | Applicant, Manager, Owner | Applicant must own the application; Manager may access any existing application; Owner must own the application's property. Existing applications requested by a non-owner under Owner access return 403; missing applications and another applicant's applications return 404. |

- Scope type is distinct from mutation target type: a profile targets `Profile` but authorizes against `Account`; an own-note mutation targets `ManagerNote` but authorizes against `Application` with Manager access. They do not require separate profile/note scope handlers.
- Missing handlers fail closed when requested; duplicate resource registrations fail when constructing the lookup. Unsupported resource/access combinations are rejected, not silently treated as Owner or Manager access. Role failures remain 403; resource checks retain the specific 403/404 behavior above.
- Both identical replay and receipt lookup recheck the stored server-selected scope against current authorization and matching environment generation before exposing historical outcomes. A previous authorization decision is not a permanent grant. Do not rebuild the original response from current domain rows.

### Extension and verification

- Add endpoint metadata and compatible request ID interfaces when adding a mutation; do not add controller-specific branches to the descriptor or command-name branches to the runner.
- For a new authorization scope type, implement `IOperationScopeAuthorizer` under `backend/src/RentalManagement.Api/Operations/Authorization/` and register it in `ServiceConfiguration.AddOperationAuthorization`, with explicit supported access and resource-specific denial behavior. Existing resource types reuse their handler. Keep role checks in `OperationAuthorization`; the runner needs no command-specific authorization switch.
- Unit tests must cover metadata on every mutation, initial and accepted scope registration coverage, stable command identities/fingerprints, stored scope JSON compatibility, role checks, dispatch/cancellation/error propagation, invalid access, and missing/duplicate registrations.
- Real SQL Server integration tests cover ownership/missing-resource 403/404 behavior, current-ownership changes, and authorized receipt recovery. These tests remain opt-in; do not infer that they ran from a successful build or unit-test run.

## API and Swagger

- RESTful JSON under `/api`, with protected endpoints requiring Bearer tokens. Public signup/login/refresh do not require an existing access token.
- Publish OpenAPI with request/response models, supported status codes, and a Bearer security scheme; allow token entry in Swagger UI for protected calls.
- Custom endpoint errors use Problem Details with stable codes and form-path validation errors. Built-in login/refresh retain their native response shapes.
- Document only supported routes. Enable interactive Swagger UI for development.

## Docker and local development

- Begin with SQL Server in Compose and run the API directly on the host for a fast development/debugging loop.
- Add the API service at the integration stage. Proposed Dockerfile: multi-stage SDK build and ASP.NET runtime image; publish only the application output.
- Persist SQL Server data in a named volume. Give the containerized API a separate persistent, restricted Data Protection key volume and a stable application name.
- Supply database credentials and connection strings through local secrets/environment configuration, not committed source files. Pin compatible container/runtime versions.
- API startup creates/migrates the database and applies deterministic insert-only seeds under one target-database-specific, session-owned SQL application lock in `master`. This permits coordination before the target database exists. Hold the lock through creation, migrations, and seeding; fail visibly on initialization errors and never reset user data on restart.

SQL Server must already be running. Initialization completes before requests are accepted; failure aborts startup with a safe stage identifier. Use a non-system target database. The SQL principal needs access to `master`, database-creation permission for first startup, and migration/write permissions on the target database.

### Reset/restore procedure

Stop API traffic and command execution before replacing/restoring data. Preserve `DatabaseMetadata.EnvironmentGeneration` for ordinary deployments/migrations. After a reset, clone to another API environment, or history-invalidating restore, rotate it **before restarting the API**:

```sql
UPDATE [DatabaseMetadata] SET [EnvironmentGeneration] = NEWID() WHERE [SingletonId] = 1;
```

Clients retain old work but stop replaying it after a generation mismatch. Restoring a backup's original generation unchanged defeats this safeguard. Previously restored receipts remain inaccessible through the new generation; retain them rather than deleting evidence. If no metadata row exists, normal initialization creates a new generation. See [Environment generation](offline-mode.md#environment-generation) for client recovery rules.

## Seeding

- Run demonstration seeding after migrations, under the same initialization lock. Compare metadata's seed version with a hardcoded version; matching versions skip seeding. Use Bogus with fixed local seeds and deterministic, version-specific IDs/emails so repeated startup does not duplicate data and a new version appends an independent dataset.
- Insert missing demonstration records only; never overwrite user edits or reset existing data.
- Include both roles, properties/units, and applications in every status, including `InReview`. Seed Apartment, Studio, and Loft as active types, plus inactive Penthouse with an existing assigned unit.
- Keep application history, approved leases, and unit lease guards consistent; insert related records transactionally. Create demonstration users through Identity so passwords are hashed normally.
- Seed demonstration data in all environments. Obtain new demo-account passwords through secrets/environment configuration; never reset existing passwords. Reuse existing roles and unit types without overwriting edits.
- The demo password is required only when applying a new seed version; an already-applied version does not require it on restart. Never commit or log the password.
- Insert each new dataset and its seed-version marker transactionally. Do not repair old partial graphs; leave existing data untouched. Fail visibly on seeding errors, current-version identity collisions, and seed-version downgrades.

## Logging and error format

- Use ASP.NET Core `ILogger<T>` with structured fields, not interpolated messages. Include operation ID (when available), command type, duration, HTTP status, and stable error code.
- Log routine request/command completion at Information, expected rejection/retry at Warning where useful, and unexpected failures at Error. Avoid repetitive logs for normal field-validation failures.
- Never log credentials, tokens, request/response bodies, personal data, private notes, or review comments—even during development.
- Handle unexpected exceptions centrally: log diagnostic details server-side and return a safe Problem Details response without stack traces or database details.

Request logs use static endpoint names, durations, status codes, and safe error identifiers; request/response bodies and query strings are not logged. Suppress Identity and potentially data-bearing EF command/update logs. Unexpected exceptions log type and stack location, not messages that may contain SQL values.

Custom auth and business endpoints use `application/problem+json` with standard Problem Details fields plus a stable `code`. Final command errors also include `operationId`; validation errors use exact form paths:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 422,
  "code": "<stable validation code>",
  "operationId": "<command UUID>",
  "validation": {
    "form": "Please correct the highlighted fields.",
    "fields": {
      "applicantInformation.phone": "Use NNN-NNN-NNNN."
    }
  }
}
```

The example illustrates the envelope, not a finalized error-code catalog. `validation.form` is optional; each field path maps to one message. Clients branch on `code`, not human-readable text.

| Status | Meaning |
| --- | --- |
| 400 | Malformed request or encoding. |
| 401 | Missing/invalid authentication. |
| 403 | Forbidden role/action. |
| 404 | Missing or inaccessible resource, without leaking private details. |
| 409 | Stale version, illegal transition, duplicate application, or unavailable/archived inventory. |
| 422 | Invalid supplied field values. |
| 500 | Unexpected server failure; no internal details exposed. |
| 503 | Temporary command failure or exhausted coherent-read retries. |

Built-in Identity login/refresh retain their native responses, including potentially empty refresh 401 responses.

## Configuration and verification

- The .NET SDK and EF tooling are pinned in `backend/global.json` and `backend/.config/dotnet-tools.json`, scoped to the backend rather than a sibling `mobile/` directory. API package resolutions are recorded in `backend/src/RentalManagement.Api/packages.lock.json`. See the [backend README](../../backend/README.md) for setup and verification commands.
- Configure connection strings, Data Protection storage, authentication lifetimes, and environment-specific API settings explicitly. HTTPS/TLS and production secret handling remain deployment work.
- Unit-test validation and business rules; use real SQL Server integration tests for transactions, constraints, authorization, replay, and competing approvals.
- Opt-in SQL Server integration coverage includes startup/seeding, business workflows, receipt replay/rollback/recovery, logout acknowledgements, resource-specific authorization denials, and current-ownership changes. These tests create/drop temporary databases; a successful build or unit-test run does not mean they ran.
- OpenAPI schemas, Identity route restrictions, migrations, seeds, and runtime/package compatibility must be verified.
