# Rental Management backend

.NET 10 controller-based API with GUID-keyed ASP.NET Core Identity and EF Core SQL Server persistence.

## Layout

- `src/RentalManagement.Api`: controllers, contracts, services, domain, persistence, authentication, validation, and infrastructure.
- `src/RentalManagement.Api/Persistence/Migrations`: one migration stream for Identity and domain tables.
- `tests/RentalManagement.UnitTests` and `tests/RentalManagement.IntegrationTests`: unit and integration tests.
- `../compose.yaml`: local SQL Server only.

## Prerequisites and restore

Run the commands below from `backend/`. The SDK is pinned in `backend/global.json`; EF tooling is pinned in `backend/.config/dotnet-tools.json`. These configurations are scoped to the backend and do not affect a sibling `mobile/` directory. API package resolutions are recorded in `src/RentalManagement.Api/packages.lock.json`.

```bash
dotnet tool restore
dotnet restore RentalManagement.sln
dotnet build RentalManagement.sln
```

## Local secrets

Copy the repository root's `.env.example` to `.env` and replace `MSSQL_SA_PASSWORD` with a strong local password meeting SQL Server requirements.

Compose reads `.env`; the API does **not**. Set the matching API connection string through .NET user secrets:

```bash
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=localhost,1433;Database=RentalManagement;User Id=sa;Password=<your-local-password>;Encrypt=True;TrustServerCertificate=True' --project src/RentalManagement.Api
```

Set the demo password through secrets as well (12–128 characters, not only whitespace):

```bash
dotnet user-secrets set 'Seeding:DemoPassword' '<your-demo-account-password>' --project src/RentalManagement.Api
```

The environment equivalents are `ConnectionStrings__DefaultConnection` and `Seeding__DemoPassword`. No demo password is committed or logged. The password is required when applying a new seed version; a restart with the already-applied version does not require it and never resets existing passwords.

Startup connects to SQL Server, creates the target database if missing, applies migrations, and seeds before accepting requests. SQL Server must already be running. The configured SQL principal needs access to `master`, database-creation permission for first startup, and migration/write permissions on the target database. Use a non-system database name. Initialization failure aborts startup with a safe stage identifier; it is never ignored.

## SQL Server — when you are ready

**These commands have not been run as part of initialization.** Docker must be available before performing them:

```bash
docker compose --env-file ../.env -f ../compose.yaml up -d sqlserver
```
API startup performs database creation and migrations automatically; manual `dotnet ef database update` is not required.

## Verification without starting SQL Server

```bash
dotnet build RentalManagement.sln
dotnet test tests/RentalManagement.UnitTests
dotnet ef migrations has-pending-model-changes --project src/RentalManagement.Api --startup-project src/RentalManagement.Api
```

Real SQL Server integration tests are opt-in through `RENTAL_TEST_SQLSERVER`. When explicitly enabled, run `dotnet test tests/RentalManagement.IntegrationTests`. They create and drop uniquely named `RentalManagement_SeedTests_*` databases on the supplied server, require creation/drop permissions, and cover concurrent fresh startup, repeat startup/preservation, rollback/retry, and appending alongside older data. They do not start Docker themselves.

## Run the host API

```bash
dotnet run --project src/RentalManagement.Api --launch-profile http
```

Development API: `http://localhost:5118/api`; Swagger UI: `http://localhost:5118/swagger`. Development permits HTTP for the local loop. The HTTPS launch profile is also available; set `Api__RequireHttps=true` to enforce redirection. Production enables redirection by default and has no Swagger UI. Configure valid hosts, certificates, proxy handling, and HTTPS deployment before exposing the API.

## Validation and request transformation

Use **FluentValidation with explicit request-to-command mapping** for custom endpoints. Validators are registered as scoped `IValidator<T>` services and invoked with `ValidateAsync` inside the application service, before opening a database transaction. This keeps validation active for non-controller callers and allows future asynchronous rules. We do not use FluentValidation's MVC auto-validation integration, DTO validation attributes, or a global string-trimming JSON converter.

## Data Protection and logging

Logs contain static endpoint names, durations, status codes, and safe error identifiers. No request/response body or query-string logging is enabled. Identity and potentially data-bearing EF command/update logs are suppressed. Unexpected exceptions log type and stack location, not messages that may contain SQL values. Custom endpoints use safe `application/problem+json` envelopes with stable `code`; field validation uses `validation.fields`. Native Identity login/refresh failures remain native, including potentially empty 401 responses.
