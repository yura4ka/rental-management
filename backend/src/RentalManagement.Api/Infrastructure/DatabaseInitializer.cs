using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Persistence.Seeding;

namespace RentalManagement.Api.Infrastructure;

public sealed class DatabaseInitializer(ApplicationDbContext db, DemonstrationSeeder seeder,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        var stage = "Configuration";
        try
        {
            var connection = new SqlConnectionStringBuilder(db.Database.GetConnectionString());
            var database = connection.InitialCatalog;
            if (string.IsNullOrWhiteSpace(database) || database.Length > 128 ||
                new[] { "master", "model", "msdb", "tempdb" }.Contains(database, StringComparer.OrdinalIgnoreCase))
                throw new InvalidOperationException("Configure a non-system target database name (maximum 128 characters).");

            // An absent target cannot own a lock. Coordinate in master using a target-specific resource.
            // No pooling or transparent reconnect: losing this session must never silently lose the lock.
            connection.InitialCatalog = "master";
            connection.Pooling = false;
            connection.ConnectRetryCount = 0;
            await using var master = new SqlConnection(connection.ConnectionString);
            stage = "Connection";
            await master.OpenAsync(cancellationToken);
            var resource = "RentalManagement.Initialize:" + Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(database.ToUpperInvariant())));
            await using var acquire = master.CreateCommand();
            acquire.CommandTimeout = 130;
            acquire.CommandText = """
                DECLARE @result int;
                EXEC @result = sys.sp_getapplock @Resource = @resource,
                    @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 120000;
                SELECT @result;
                """;
            acquire.Parameters.Add("@resource", SqlDbType.NVarChar, 255).Value = resource;
            stage = "LockAcquisition";
            if (Convert.ToInt32(await acquire.ExecuteScalarAsync(cancellationToken)) < 0)
                throw new InvalidOperationException("Database initialization lock could not be acquired.");

            try
            {
                stage = "DatabaseCreation";
                await using var create = master.CreateCommand();
                create.CommandTimeout = 120;
                create.CommandText = """
                    IF DB_ID(@database) IS NULL
                    BEGIN
                        DECLARE @sql nvarchar(max) = N'CREATE DATABASE ' + QUOTENAME(@database);
                        EXEC sys.sp_executesql @sql;
                    END
                    """;
                create.Parameters.Add("@database", SqlDbType.NVarChar, 128).Value = database;
                await create.ExecuteNonQueryAsync(cancellationToken);
                stage = "Migrations";
                await db.Database.MigrateAsync(cancellationToken);
                stage = "Seeding";
                await seeder.SeedAsync(cancellationToken);
            }
            finally
            {
                await using var release = master.CreateCommand();
                release.CommandText = "EXEC sys.sp_releaseapplock @Resource = @resource, @LockOwner = 'Session';";
                release.Parameters.Add("@resource", SqlDbType.NVarChar, 255).Value = resource;
                await release.ExecuteNonQueryAsync(CancellationToken.None);
            }
            logger.LogInformation("Database initialization completed with seed version {SeedVersion}.", DemoSeedData.CurrentVersion);
        }
        catch (Exception exception)
        {
            // Do not log SQL/Identity exception messages: they can include credentials or seeded PII.
            logger.LogError("Database initialization failed at {Stage} ({ErrorType}); startup aborted. Stack location: {StackLocation}",
                stage, exception.GetType().Name, exception.StackTrace);
            throw new InvalidOperationException($"Database initialization failed at {stage}. Check SQL Server availability, permissions, migrations, and Seeding:DemoPassword configuration.");
        }
    }
}
