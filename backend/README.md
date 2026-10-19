# Rental Management backend

.NET 10 API with ASP.NET Core Identity and EF Core SQL Server.

## Setup

Install the .NET SDK specified in `global.json` and Docker with Compose. Run all commands below from `backend/`.

```bash
dotnet tool restore
dotnet restore RentalManagement.sln
dotnet build RentalManagement.sln
```

## Local secrets

Copy the repository root's `.env.example` to `.env` and set a strong `MSSQL_SA_PASSWORD` meeting SQL Server requirements:

```bash
cp ../.env.example ../.env
```

Compose reads `.env`; the API does **not**. Set the matching API connection string through .NET user secrets:

```bash
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=127.0.0.1,1433;Database=RentalManagement;User Id=sa;Password=<your-local-password>;Encrypt=True;TrustServerCertificate=True' --project src/RentalManagement.Api
```

Set the demo password through secrets as well (12–128 characters, not only whitespace):

```bash
dotnet user-secrets set 'Seeding:DemoPassword' '<your-demo-account-password>' --project src/RentalManagement.Api
```

Environment equivalents: `ConnectionStrings__DefaultConnection` and `Seeding__DemoPassword`. The demo password is needed for each new seed version; existing passwords are never reset. Do not commit secrets.

## Start SQL Server and the API

```bash
docker compose --env-file ../.env -f ../compose.yaml up -d sqlserver
dotnet run --project src/RentalManagement.Api --launch-profile http
```

Wait for SQL Server to be ready before starting the API. Startup creates the database, applies migrations, and seeds automatically; manual `dotnet ef database update` is not required.

- API: `http://localhost:5118/api`
- Swagger UI (Development only): `http://localhost:5118/swagger`
- HTTPS: use `--launch-profile https`; `Api__RequireHttps=true` enforces redirection (enabled by default in Production). Configure hosts, certificates, and proxies before exposing the API.

## Database

Use a non-system database and disable Multiple Active Result Sets (MARS). The SQL principal needs access to `master`, database-creation permission on first startup, and migration/write permissions on the target database. Initialization failure stops the API.

Compose persists SQL Server data in a named volume. Before resetting, cloning, or restoring data, follow the [reset/restore procedure](../docs/specs/backend-architecture.md#resetrestore-procedure).

## Verification without starting SQL Server

```bash
dotnet build RentalManagement.sln
dotnet test tests/RentalManagement.UnitTests
dotnet ef migrations has-pending-model-changes --project src/RentalManagement.Api --startup-project src/RentalManagement.Api
```

## SQL Server integration tests (opt-in)

Set `RENTAL_TEST_SQLSERVER` to a test-server connection string, then run:

```bash
dotnet test tests/RentalManagement.IntegrationTests
```

These tests create/drop uniquely named `RentalManagement_SeedTests_*` databases and require creation/drop permissions. They do not start Docker. Without the variable, database tests are skipped; build/unit-test success does not mean they ran.

## Technical documentation

- [Backend architecture](../docs/specs/backend-architecture.md): layout, validation, transactions, authorization, seeding, and logging.
- [Offline protocol](../docs/specs/offline-mode.md): command contracts, fingerprints, receipts, and recovery.
- [Authentication](../docs/specs/auth.md): tokens, logout, and Data Protection requirements.
