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

Startup validates configuration but does not connect to SQL Server, create databases, run migrations, or seed records. Without a connection string, startup fails with a configuration message.

## Database setup — manual, when you are ready

**These commands have not been run as part of initialization.** Docker must be available before performing them:

```bash
docker compose --env-file ../.env -f ../compose.yaml up -d sqlserver
dotnet ef database update --project src/RentalManagement.Api --startup-project src/RentalManagement.Api
```

## Run the host API

```bash
dotnet run --project src/RentalManagement.Api --launch-profile http
```

Development API: `http://localhost:5118/api`; Swagger UI: `http://localhost:5118/swagger`. Development permits HTTP for the local loop. The HTTPS launch profile is also available; set `Api__RequireHttps=true` to enforce redirection. Production enables redirection by default and has no Swagger UI. Configure valid hosts, certificates, proxy handling, and HTTPS deployment before exposing the API.

## Validation and request transformation

Use **FluentValidation with explicit request-to-command mapping** for custom endpoints. Validators are registered as scoped `IValidator<T>` services and invoked with `ValidateAsync` inside the application service, before opening a database transaction. This keeps validation active for non-controller callers and allows future asynchronous rules. We do not use FluentValidation's MVC auto-validation integration, DTO validation attributes, or a global string-trimming JSON converter.

## Data Protection and logging

Logs contain static endpoint names, durations, status codes, and safe error identifiers. No request/response body or query-string logging is enabled. Identity and potentially data-bearing EF command/update logs are suppressed. Unexpected exceptions log type and stack location, not messages that may contain SQL values. Custom endpoints use safe `application/problem+json` envelopes with stable `code`; field validation uses `validation.fields`. Native Identity login/refresh failures remain native, including potentially empty 401 responses.
