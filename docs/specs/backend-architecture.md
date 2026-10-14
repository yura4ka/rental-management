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
    Operations/            # Command runner, fingerprints, receipts, recovery
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

## Seeding

- Run demonstration seeding after migrations, under the same initialization lock. Compare metadata's seed version with a hardcoded version; matching versions skip seeding. Use Bogus with fixed local seeds and deterministic, version-specific IDs/emails so repeated startup does not duplicate data and a new version appends an independent dataset.
- Insert missing demonstration records only; never overwrite user edits or reset existing data.
- Include both roles, properties/units, and applications in every status, including `InReview`. Seed Apartment, Studio, and Loft as active types, plus inactive Penthouse with an existing assigned unit.
- Keep application history, approved leases, and unit lease guards consistent; insert related records transactionally. Create demonstration users through Identity so passwords are hashed normally.
- Seed demonstration data in all environments. Obtain new demo-account passwords through secrets/environment configuration; never reset existing passwords. Reuse existing roles and unit types without overwriting edits.
- Insert each new dataset and its seed-version marker transactionally. Do not repair old partial graphs; leave existing data untouched. Fail visibly on seeding errors, current-version identity collisions, and seed-version downgrades.

## Logging and error format

- Use ASP.NET Core `ILogger<T>` with structured fields, not interpolated messages. Include operation ID (when available), command type, duration, HTTP status, and stable error code.
- Log routine request/command completion at Information, expected rejection/retry at Warning where useful, and unexpected failures at Error. Avoid repetitive logs for normal field-validation failures.
- Never log credentials, tokens, request/response bodies, personal data, private notes, or review comments—even during development.
- Handle unexpected exceptions centrally: log diagnostic details server-side and return a safe Problem Details response without stack traces or database details.

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

- Configure connection strings, Data Protection storage, authentication lifetimes, and environment-specific API settings explicitly. HTTPS/TLS and production secret handling remain deployment work.
- Unit-test validation and business rules; use real SQL Server integration tests for transactions, constraints, authorization, replay, and competing approvals.
- OpenAPI schemas, Identity route restrictions, migrations, seeds, and runtime/package compatibility must be verified.
