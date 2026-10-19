# Running locally

## Prerequisites

- .NET SDK 10.0.110 (or a compatible .NET 10 feature band).
- Docker with Compose, or SQLServer.
- Node.js LTS and npm.
- Android Studio with an Android emulator, or macOS with Xcode for the iOS simulator.

## Backend

From the repository root, copy `.env.example` to `.env` and replace `MSSQL_SA_PASSWORD` with a strong SQL Server password. Keep `SQLSERVER_PORT=1433` for the commands below.

```bash
cp .env.example .env
cd backend
dotnet tool restore
dotnet restore RentalManagement.sln
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=127.0.0.1,1433;Database=RentalManagement;User Id=sa;Password=<your-local-password>;Encrypt=True;TrustServerCertificate=True" --project src/RentalManagement.Api
dotnet user-secrets set "Seeding:DemoPassword" "<your-demo-account-password>" --project src/RentalManagement.Api
docker compose --env-file ../.env -f ../compose.yaml up -d sqlserver
```

**Wait for SQL Server to be ready before starting the API.** Only continue once the command completes successfully; if it fails or times out, resolve the container error first.

```bash
dotnet run --project src/RentalManagement.Api --launch-profile http
```

Use the same SQL Server password in `.env` and the connection string. The demo password must be 12–128 characters and not only whitespace. The API does not read the root `.env` file.

Startup creates the database, applies migrations, and seeds demo data automatically. Leave the API running:

- API: http://localhost:5118/api
- Swagger UI: http://localhost:5118/swagger

## Mobile

In a separate terminal, from the repository root:

```bash
cd mobile
npm ci
cp .env.example .env.local
```

For an Android emulator, set these values in `mobile/.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5118
EXPO_PUBLIC_IS_ANDROID_EMULATOR=true
```

Start the emulator, then build and launch the app:

```bash
npm run android
```

For the iOS simulator (macOS only), keep `EXPO_PUBLIC_API_URL=http://localhost:5118`, omit the Android emulator flag, and run:

```bash
npm run ios
```

The app requires a native development build; Expo Go is not supported. After the initial build, restart the development server with:

```bash
npm start -- --dev-client
```

For a physical device, use your computer's LAN IP in `EXPO_PUBLIC_API_URL` (for example, `http://192.168.1.10:5118`), connect both devices to the same network, and allow port 5118 through your firewall. Restart the backend with LAN access enabled:

```bash
dotnet run --project src/RentalManagement.Api --launch-profile http --urls http://0.0.0.0:5118
```

Restart the mobile development server after changing `.env.local`.
