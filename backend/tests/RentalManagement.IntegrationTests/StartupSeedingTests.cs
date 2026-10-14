using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Persistence.Seeding;

namespace RentalManagement.IntegrationTests;

public sealed class SqlServerFactAttribute : FactAttribute
{
    public SqlServerFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RENTAL_TEST_SQLSERVER")))
            Skip = "Set RENTAL_TEST_SQLSERVER to explicitly enable real SQL Server tests.";
    }
}

public sealed class StartupSeedingTests
{
    [SqlServerFact]
    public async Task ConcurrentFreshStartupCreatesMigratesAndSeedsExactlyOnce()
    {
        await using var fixture = new DatabaseFixture();
        await Task.WhenAll(fixture.InitializeAsync(), fixture.InitializeAsync());
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(9, await db.Users.CountAsync());
        Assert.Equal(2, await db.Roles.CountAsync());
        Assert.Equal(9, await db.UserRoles.CountAsync());
        Assert.All(await db.Users.ToListAsync(), u => Assert.False(string.IsNullOrEmpty(u.PasswordHash)));
        Assert.Equal(4, await db.Properties.CountAsync());
        Assert.Equal(8, await db.Units.CountAsync());
        Assert.Equal(7, await db.RentalApplications.CountAsync());
        Assert.Equal(8, await db.UnitLeaseGuards.CountAsync());
        Assert.Equal(1, await db.Leases.CountAsync());
        Assert.Equal(DemoSeedData.CurrentVersion, (await db.DatabaseMetadata.SingleAsync()).SeedVersion);
        Assert.False((await db.UnitTypes.SingleAsync(t => t.Code == "Penthouse")).IsActive);
        var penthouse = await db.UnitTypes.SingleAsync(t => t.Code == "Penthouse");
        Assert.True(await db.Units.AnyAsync(u => u.UnitTypeId == penthouse.Id));
        Assert.Equal(7, (await db.RentalApplications.Select(a => a.Status).Distinct().ToListAsync()).Count);
        var application = await db.RentalApplications.SingleAsync(a => a.Status == ApplicationStatus.Approved);
        var lease = await db.Leases.SingleAsync();
        Assert.Equal(lease.EndDateExclusive, (await db.UnitLeaseGuards.SingleAsync(g => g.UnitId == application.UnitId)).ConfirmedLeaseEndExclusive);
        Assert.Equal(application.StatusChangedAt, (await db.ApplicationStatusHistory.Where(h => h.ApplicationId == application.Id).OrderBy(h => h.Sequence).LastAsync()).OccurredAt);
    }

    [SqlServerFact]
    public async Task RestartPreservesUserEditsAndDoesNotRequireDemoPassword()
    {
        await using var fixture = new DatabaseFixture();
        await fixture.InitializeAsync();
        Guid unitId;
        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var unit = await db.Units.FirstAsync();
            unitId = unit.Id;
            unit.MonthlyRent = 5432;
            var profile = await db.ApplicantProfiles.FirstAsync();
            profile.Name = "User edited name";
            await db.SaveChangesAsync();
        }
        fixture.Configuration["Seeding:DemoPassword"] = null;
        await fixture.InitializeAsync();
        await using var verify = fixture.Services.CreateAsyncScope();
        var context = verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(5432, (await context.Units.SingleAsync(u => u.Id == unitId)).MonthlyRent);
        Assert.True(await context.ApplicantProfiles.AnyAsync(p => p.Name == "User edited name"));
        Assert.Equal(9, await context.Users.CountAsync());
    }

    [SqlServerFact]
    public async Task FailedSeedRollsBackAndCanBeRetried()
    {
        await using var fixture = new DatabaseFixture();
        fixture.Configuration["Seeding:DemoPassword"] = "short";
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.InitializeAsync());
        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(0, await db.DatabaseMetadata.CountAsync());
            Assert.Equal(0, await db.Users.CountAsync());
            // The initial migration inserts the two roles; seed rollback must retain migration data.
            Assert.Equal(2, await db.Roles.CountAsync());
            Assert.Equal(0, await db.UnitTypes.CountAsync());
        }
        fixture.Configuration["Seeding:DemoPassword"] = "Integration demo password";
        await fixture.InitializeAsync();
    }

    [SqlServerFact]
    public async Task OlderSeedVersionAppendsWithoutRepairingOldGraphs()
    {
        await using var fixture = new DatabaseFixture();
        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();
            var oldData = DemoSeedData.Create(DemoSeedData.TypeCodes.ToDictionary(c => c, c => DemoSeedData.Id($"type:{c}", 0)), 42);
            var oldUser = new Microsoft.AspNetCore.Identity.IdentityUser<Guid> { Id = oldData.Accounts[0].Id, UserName = "old@example.com" };
            db.Users.Add(oldUser);
            var oldProperty = oldData.Properties[0];
            oldProperty.OwnerManagerId = oldUser.Id;
            oldProperty.Address.StreetAddress = "Preserve this old property";
            db.Properties.Add(oldProperty);
            db.DatabaseMetadata.Add(new DatabaseMetadata { EnvironmentGeneration = Guid.NewGuid(), InitializedAt = DateTimeOffset.UtcNow, SeedVersion = 0 });
            await db.SaveChangesAsync();
        }
        await fixture.InitializeAsync();
        await using var verify = fixture.Services.CreateAsyncScope();
        var context = verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(5, await context.Properties.CountAsync());
        Assert.Equal(10, await context.Users.CountAsync());
        Assert.True(await context.Properties.AnyAsync(p => p.Address.StreetAddress == "Preserve this old property"));
    }

    private sealed class DatabaseFixture : IAsyncDisposable
    {
        private readonly string database = "RentalManagement_SeedTests_" + Guid.NewGuid().ToString("N");
        private readonly string masterConnection;
        private readonly string keyPath = "/tmp/opencode/rental-seed-tests-" + Guid.NewGuid().ToString("N");
        internal IConfigurationRoot Configuration { get; }
        internal ServiceProvider Services { get; }

        internal DatabaseFixture()
        {
            var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("RENTAL_TEST_SQLSERVER")) { InitialCatalog = database, Pooling = false };
            Configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connection.ConnectionString,
                ["Seeding:DemoPassword"] = "Integration demo password",
                ["DataProtection:ApplicationName"] = "RentalManagement.SeedTests",
                ["DataProtection:KeyPath"] = keyPath
            }).Build();
            connection.InitialCatalog = "master";
            masterConnection = connection.ConnectionString;
            var services = new ServiceCollection();
            services.AddSingleton<IConfiguration>(Configuration);
            services.AddLogging(logging => logging.SetMinimumLevel(LogLevel.None));
            services.AddApplication(Configuration, new TestEnvironment());
            Services = services.BuildServiceProvider();
        }

        internal async Task InitializeAsync()
        {
            await using var scope = Services.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await Services.DisposeAsync();
            await using var connection = new SqlConnection(masterConnection);
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            // Only this fixture's newly generated database is ever removed.
            command.CommandText = $"IF DB_ID(@name) IS NOT NULL BEGIN ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END";
            command.Parameters.AddWithValue("@name", database);
            await command.ExecuteNonQueryAsync();
            Directory.Delete(keyPath);
        }
    }

    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "RentalManagement.Api";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
