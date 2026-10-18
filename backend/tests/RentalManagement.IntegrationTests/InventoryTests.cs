using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Auth;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.IntegrationTests;

public sealed class InventoryTests
{
    [SqlServerFact]
    public async Task MaintenanceEnforcesOwnershipVersionsTypesAndPermanentArchive()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var anonymous = app.GetTestClient();
        using var owner = await AccountAsync(app, AccountRoles.PropertyManager);
        using var other = await AccountAsync(app, AccountRoles.PropertyManager);
        using var applicant = await AccountAsync(app, AccountRoles.Applicant);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/properties")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/available-units")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/unit-types")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.GetAsync("/api/properties")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.PostAsJsonAsync("/api/properties",
            new CreatePropertyRequest(new(null, "123 Main", null)))).StatusCode);

        var types = await owner.GetFromJsonAsync<UnitTypeResponse[]>("/api/unit-types");
        var active = types!.First(t => t.IsActive).Id;
        var inactive = types!.First(t => !t.IsActive).Id;
        var property = await CreatePropertyAsync(owner);
        var path = $"/api/properties/{property.Id}";
        Assert.Equal("Marketing, 123 Main", property.DisplayAddress);
        Assert.Equal("1", property.Version);
        Assert.Equal(1, (await PageAsync(owner, "/api/properties")).GetProperty("totalCount").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(path + "/units")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync(path,
            new UpdatePropertyRequest(1, new(null, "Other", null)), WireOptions)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync(path + "/units",
            new CreateUnitRequest("A", active, 0, 100))).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await owner.PostAsJsonAsync(path + "/units",
            new CreateUnitRequest("A", inactive, 0, 100))).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await owner.PostAsJsonAsync(path + "/units",
            new CreateUnitRequest("a", active, 0, 100))).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await owner.PostAsJsonAsync(path + "/units",
            new CreateUnitRequest("A", Guid.NewGuid(), 0, 100))).StatusCode);

        var unit = await CreateUnitAsync(owner, property.Id, active, "A");
        var unitPath = path + $"/units/{unit.Id}";
        Assert.Equal(12345, unit.MonthlyRentCents);
        Assert.Equal("1", unit.Version);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsync(unitPath, Json("""
            {"expectedVersion":1,"number":"A","bedrooms":0,"monthlyRentCents":100}
            """))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync(path + "/units", Json("""
            {"number":"B","bedrooms":0,"monthlyRentCents":1.5}
            """))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync(unitPath + "/archive",
            new ArchiveInventoryRequest(1), WireOptions)).StatusCode);

        // Simulate an existing assignment whose lookup value has since become inactive.
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.True(await db.UnitLeaseGuards.AnyAsync(g => g.UnitId == unit.Id && g.Version == 1));
            Assert.Equal(123.45m, (await db.Units.SingleAsync(u => u.Id == unit.Id)).MonthlyRent);
            var row = await db.Units.SingleAsync(u => u.Id == unit.Id);
            row.UnitTypeId = inactive;
            await db.SaveChangesAsync();
        }
        var unchangedType = await owner.PutAsJsonAsync(unitPath, new UpdateUnitRequest(2, "A", inactive, 1, 12346), WireOptions);
        Assert.Equal(HttpStatusCode.OK, unchangedType.StatusCode);
        Assert.Equal("3", (await BodyAsync(unchangedType)).GetProperty("version").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(unitPath,
            new UpdateUnitRequest(2, "A", active, 0, 100), WireOptions)).StatusCode);
        var archived = await owner.PostAsJsonAsync(unitPath + "/archive", new ArchiveInventoryRequest(3), WireOptions);
        Assert.Equal(HttpStatusCode.OK, archived.StatusCode);
        Assert.Equal("4", (await BodyAsync(archived)).GetProperty("version").GetString());
        var duplicate = await owner.PostAsJsonAsync(path + "/units", new CreateUnitRequest("A", active, 0, 100));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("DuplicateUnitNumber", (await BodyAsync(duplicate)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(unitPath,
            new UpdateUnitRequest(4, "B", active, 0, 100), WireOptions)).StatusCode);
        Assert.Equal(0, (await PageAsync(owner, path + "/units")).GetProperty("totalCount").GetInt32());
        Assert.Equal(1, (await PageAsync(owner, path + "/units?includeArchived=true")).GetProperty("totalCount").GetInt32());

        var second = await CreateUnitAsync(owner, property.Id, active, "B");
        var updated = await owner.PutAsJsonAsync(path, new UpdatePropertyRequest(1, new(null, "456 Main", "Suite 2")), WireOptions);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("456 Main, Suite 2", (await BodyAsync(updated)).GetProperty("displayAddress").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync(path + "/archive", new ArchiveInventoryRequest(1), WireOptions)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.PostAsJsonAsync(path + "/archive", new ArchiveInventoryRequest(2), WireOptions)).StatusCode);
        Assert.Equal(0, (await PageAsync(owner, "/api/properties")).GetProperty("totalCount").GetInt32());
        Assert.Equal(1, (await PageAsync(owner, "/api/properties?includeArchived=true")).GetProperty("totalCount").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync(path + "/units",
            new CreateUnitRequest("C", active, 0, 100))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(path,
            new UpdatePropertyRequest(3, new(null, "Restored", null)), WireOptions)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync(path + "/archive", new ArchiveInventoryRequest(3), WireOptions)).StatusCode);
        var rows = (await PageAsync(owner, path + "/units?includeArchived=true")).GetProperty("items").EnumerateArray().ToArray();
        Assert.All(rows, u => Assert.NotEqual(JsonValueKind.Null, u.GetProperty("archivedAt").ValueKind));
        Assert.Equal("4", rows.Single(u => u.GetProperty("id").GetGuid() == unit.Id).GetProperty("version").GetString());
        Assert.Equal("2", rows.Single(u => u.GetProperty("id").GetGuid() == second.Id).GetProperty("version").GetString());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await owner.GetAsync("/api/properties?pageSize=101")).StatusCode);
    }

    [SqlServerFact]
    public async Task AvailabilityUsesUtcHalfOpenLeaseDatesAndArchivalPreservesLinkedRecords()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var manager = await AccountAsync(app, AccountRoles.PropertyManager);
        using var applicant = await AccountAsync(app, AccountRoles.Applicant);
        var type = (await manager.GetFromJsonAsync<UnitTypeResponse[]>("/api/unit-types"))!.First(t => t.IsActive).Id;
        var property = await CreatePropertyAsync(manager);
        var units = new List<TestUnit>();
        foreach (var number in new[] { "FREE", "CURRENT", "STARTS_TODAY", "ENDS_TODAY", "FUTURE", "PAST", "ARCHIVED" })
            units.Add(await CreateUnitAsync(manager, property.Id, type, number));
        var today = new DateOnly(2026, 10, 15);
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var template = await db.RentalApplications.AsNoTracking().FirstAsync();
            foreach (var (number, start, end) in new[]
            {
                ("CURRENT", today.AddMonths(-6), today.AddMonths(6)),
                ("STARTS_TODAY", today, today.AddMonths(12)),
                ("ENDS_TODAY", today.AddMonths(-12), today),
                ("FUTURE", today.AddDays(1), today.AddDays(1).AddMonths(12)),
                ("PAST", today.AddMonths(-24), today.AddMonths(-12))
            })
            {
                var unit = units.Single(u => u.Number == number);
                var application = new RentalApplication
                {
                    ApplicantId = template.ApplicantId, UnitId = unit.Id, Status = ApplicationStatus.Approved,
                    ApplicantName = template.ApplicantName, ApplicantPhone = template.ApplicantPhone,
                    ContactEmail = template.ContactEmail,
                    CurrentAddress = new Address { StreetAddress = "Test applicant address" },
                    ApplicantInformationSavedAt = DateTimeOffset.UtcNow, ResidenceHistorySavedAt = DateTimeOffset.UtcNow,
                    StatusChangedAt = DateTimeOffset.UtcNow
                };
                db.RentalApplications.Add(application);
                db.Leases.Add(new Lease { ApplicationId = application.Id, StartDate = start,
                    EndDateExclusive = end, ApprovedAt = new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) });
                var guard = await db.UnitLeaseGuards.SingleAsync(g => g.UnitId == unit.Id);
                guard.ConfirmedLeaseEndExclusive = end;
            }
            await db.SaveChangesAsync();
        }
        var archived = units.Single(u => u.Number == "ARCHIVED");
        Assert.Equal(HttpStatusCode.OK, (await manager.PostAsJsonAsync(
            $"/api/properties/{property.Id}/units/{archived.Id}/archive", new ArchiveInventoryRequest(1), WireOptions)).StatusCode);
        var available = (await PageAsync(applicant, "/api/available-units?pageSize=100")).GetProperty("items")
            .EnumerateArray().Where(r => r.GetProperty("property").GetProperty("id").GetGuid() == property.Id)
            .Select(r => r.GetProperty("unit").GetProperty("number").GetString()).Order().ToArray();
        Assert.Equal(new[] { "ENDS_TODAY", "FREE", "FUTURE", "PAST" }, available);
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync("/api/available-units")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.PostAsJsonAsync($"/api/properties/{property.Id}/archive",
            new ArchiveInventoryRequest(1), WireOptions)).StatusCode);
        Assert.DoesNotContain((await PageAsync(applicant, "/api/available-units?pageSize=100")).GetProperty("items").EnumerateArray(),
            r => r.GetProperty("property").GetProperty("id").GetGuid() == property.Id);
        await using var verify = app.Services.CreateAsyncScope();
        var context = verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ids = units.Select(u => u.Id).ToArray();
        var applications = context.RentalApplications.Where(a => ids.Contains(a.UnitId));
        Assert.Equal(5, await applications.CountAsync());
        Assert.Equal(5, await context.Leases.CountAsync(l => applications.Select(a => a.Id).Contains(l.ApplicationId)));
        Assert.Equal(7, await context.UnitLeaseGuards.CountAsync(g => ids.Contains(g.UnitId)));
    }

    [SqlServerFact]
    public async Task AvailableUnitsFilterCentsAndSortBeforeCountingAndPaging()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var manager = await AccountAsync(app, AccountRoles.PropertyManager);
        using var applicant = await AccountAsync(app, AccountRoles.Applicant);
        var property = await CreatePropertyAsync(manager);
        var firstType = new UnitType { Code = "FILTER_FIRST", Name = "Filter first", IsActive = true };
        var secondType = new UnitType { Code = "FILTER_SECOND", Name = "Filter second", IsActive = false };
        var epoch = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var units = new[]
        {
            new Unit { PropertyId = property.Id, UnitTypeId = firstType.Id, Number = "A", Bedrooms = 0, MonthlyRent = 100.01m, CreatedAt = epoch },
            new Unit { PropertyId = property.Id, UnitTypeId = firstType.Id, Number = "B", Bedrooms = 1, MonthlyRent = 200.02m, CreatedAt = epoch.AddDays(2) },
            new Unit { PropertyId = property.Id, UnitTypeId = secondType.Id, Number = "C", Bedrooms = 1, MonthlyRent = 300.03m, CreatedAt = epoch.AddDays(1) },
            new Unit { PropertyId = property.Id, UnitTypeId = secondType.Id, Number = "D", Bedrooms = 1, MonthlyRent = 300.03m, CreatedAt = epoch.AddDays(1) },
            new Unit { PropertyId = property.Id, UnitTypeId = secondType.Id, Number = "E", Bedrooms = 2, MonthlyRent = 400.04m, CreatedAt = epoch.AddDays(3) }
        };
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.UnitTypes.AddRange(firstType, secondType);
            db.Units.AddRange(units);
            await db.SaveChangesAsync();
            var days = new[] { 0, 2, 1, 1, 3 };
            for (var i = 0; i < units.Length; i++)
            {
                var id = units[i].Id;
                var createdAt = epoch.AddDays(days[i]);
                await db.Units.Where(u => u.Id == id).ExecuteUpdateAsync(set => set.SetProperty(u => u.CreatedAt, createdAt));
                units[i].CreatedAt = createdAt;
            }
        }

        var path = $"/api/available-units?unitTypeIds={firstType.Id}&unitTypeIds={secondType.Id}";
        static string[] Numbers(JsonElement page) => page.GetProperty("items").EnumerateArray()
            .Select(r => r.GetProperty("unit").GetProperty("number").GetString()!).ToArray();

        Assert.Equal(new[] { "A", "B", "C", "D", "E" }, Numbers(await PageAsync(applicant, path)));
        Assert.Equal(new[] { "A", "B" }, Numbers(await PageAsync(applicant, $"/api/available-units?unitTypeIds={firstType.Id}")));
        Assert.Equal(new[] { "A" }, Numbers(await PageAsync(applicant, path + "&bedrooms=0")));
        Assert.Equal(new[] { "B", "C", "D" }, Numbers(await PageAsync(applicant, path + "&bedrooms=1&priceFrom=20002&priceTo=30003")));
        Assert.Equal(new[] { "B" }, Numbers(await PageAsync(applicant, path + "&priceFrom=20002&priceTo=20002")));
        Assert.Equal(new[] { "A" }, Numbers(await PageAsync(applicant, path + "&priceTo=20001")));
        Assert.Equal(new[] { "E" }, Numbers(await PageAsync(applicant, path + "&priceFrom=30004")));
        Assert.Empty(Numbers(await PageAsync(applicant, path + "&priceTo=0")));
        Assert.Empty(Numbers(await PageAsync(applicant, $"/api/available-units?unitTypeIds={Guid.NewGuid()}")));

        foreach (var sort in new[] { "price", "createdAt" })
        foreach (var direction in new[] { "asc", "desc" })
        {
            var sortedPath = path + $"&sortBy={sort}&sortDirection={direction}";
            var page = await PageAsync(applicant, sortedPath);
            var numbers = Numbers(page);
            var values = numbers.Select(n => sort == "price"
                ? units.Single(u => u.Number == n).MonthlyRent
                : units.Single(u => u.Number == n).CreatedAt.Ticks).ToArray();
            Assert.Equal(direction == "asc" ? values.Order().ToArray() : values.OrderDescending().ToArray(), values);
            var paged = new List<string>();
            for (var i = 1; i <= 3; i++)
            {
                var slice = await PageAsync(applicant, sortedPath + $"&page={i}&pageSize=2");
                Assert.Equal(5, slice.GetProperty("totalCount").GetInt32());
                paged.AddRange(Numbers(slice));
            }
            Assert.Equal(numbers, paged);
        }
        var filteredPage = await PageAsync(applicant, path + "&bedrooms=1&priceFrom=20002&priceTo=30003&pageSize=1");
        Assert.Equal(3, filteredPage.GetProperty("totalCount").GetInt32());
        Assert.Single(Numbers(filteredPage));

        foreach (var query in new[] { "bedrooms=-1", "priceFrom=-1", "priceTo=1000000000000", "priceFrom=2&priceTo=1", "sortBy=unknown", "sortDirection=up" })
            Assert.Equal(HttpStatusCode.UnprocessableEntity, (await applicant.GetAsync(path + "&" + query)).StatusCode);
        foreach (var query in new[] { "priceFrom=1.5", "bedrooms=1.5", "unitTypeIds=invalid" })
            Assert.Equal(HttpStatusCode.BadRequest, (await applicant.GetAsync("/api/available-units?" + query)).StatusCode);
    }

    [SqlServerFact]
    public async Task ConcurrentWritesSerializeAndArchiveIsAtomic()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var owner = await AccountAsync(app, AccountRoles.PropertyManager);
        var type = (await owner.GetFromJsonAsync<UnitTypeResponse[]>("/api/unit-types"))!.First(t => t.IsActive).Id;
        var property = await CreatePropertyAsync(owner);
        var path = $"/api/properties/{property.Id}";
        var unit = await CreateUnitAsync(owner, property.Id, type, "A");
        var edits = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => owner.PutAsJsonAsync(path + $"/units/{unit.Id}",
            new UpdateUnitRequest(1, "A", type, 1, 100), WireOptions)));
        Assert.Single(edits, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(edits, r => r.StatusCode == HttpStatusCode.Conflict);
        var duplicates = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => owner.PostAsJsonAsync(path + "/units",
            new CreateUnitRequest("B", type, 0, 100))));
        Assert.Single(duplicates, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(duplicates, r => r.StatusCode == HttpStatusCode.Conflict);

        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE [Units] ADD CONSTRAINT [CK_TestArchiveFailure]
                CHECK ([Number] <> N'B' OR [ArchivedAt] IS NULL)
                """);
        }
        Assert.Equal(HttpStatusCode.InternalServerError, (await owner.PostAsJsonAsync(path + "/archive",
            new ArchiveInventoryRequest(1), WireOptions)).StatusCode);
        var current = (await PageAsync(owner, "/api/properties")).GetProperty("items").EnumerateArray().Single();
        Assert.Equal("1", current.GetProperty("version").GetString());
        Assert.Equal(2, (await PageAsync(owner, path + "/units")).GetProperty("totalCount").GetInt32());
        await using (var scope = app.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database
                .ExecuteSqlRawAsync("ALTER TABLE [Units] DROP CONSTRAINT [CK_TestArchiveFailure]");
        }
        var race = await Task.WhenAll(owner.PostAsJsonAsync(path + "/archive", new ArchiveInventoryRequest(1), WireOptions),
            owner.PostAsJsonAsync(path + "/units", new CreateUnitRequest("C", type, 0, 100)),
            owner.PutAsJsonAsync(path + $"/units/{unit.Id}", new UpdateUnitRequest(2, "A", type, 2, 200), WireOptions));
        Assert.Equal(HttpStatusCode.OK, race[0].StatusCode);
        Assert.Contains(race[1].StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
        Assert.Contains(race[2].StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        await using var verify = app.Services.CreateAsyncScope();
        var context = verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await context.Units.AnyAsync(u => u.PropertyId == property.Id && u.ArchivedAt == null));
        Assert.Equal(await context.Units.CountAsync(u => u.PropertyId == property.Id),
            await context.UnitLeaseGuards.CountAsync(g => context.Units.Any(u => u.Id == g.UnitId && u.PropertyId == property.Id)));
    }

    private static async Task<WebApplication> StartAsync(StartupSeedingTests.DatabaseFixture fixture)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddConfiguration(fixture.Configuration);
        builder.Logging.ClearProviders();
        builder.Services.AddApplication(builder.Configuration, builder.Environment);
        builder.Services.Replace(ServiceDescriptor.Singleton<TimeProvider>(new FixedClock()));
        builder.Services.AddControllers().AddApplicationPart(typeof(PropertiesController).Assembly);
        var app = builder.Build();
        app.UseMiddleware<ApiErrorMiddleware>();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        app.MapApprovedIdentityEndpoints();
        await app.StartAsync();
        return app;
    }

    private static async Task<HttpClient> AccountAsync(WebApplication app, string role)
    {
        var client = await OfflineTestClient.CreateAsync(app);
        var email = Guid.NewGuid().ToString("N") + "@example.com";
        const string password = "Inventory test password";
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/auth/signup",
            new SignupRequest(email, password, role))).StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            (await BodyAsync(login)).GetProperty("accessToken").GetString());
        return client;
    }

    private static async Task<TestProperty> CreatePropertyAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/properties", new CreatePropertyRequest(new(" Marketing ", "123 Main", " ")));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await BodyAsync(response);
        return new(body.GetProperty("id").GetGuid(), body.GetProperty("version").GetString()!,
            body.GetProperty("displayAddress").GetString()!);
    }

    private static async Task<TestUnit> CreateUnitAsync(HttpClient client, Guid propertyId, Guid typeId, string number)
    {
        var response = await client.PostAsJsonAsync($"/api/properties/{propertyId}/units",
            new CreateUnitRequest(number, typeId, 0, 12345));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await BodyAsync(response);
        return new(body.GetProperty("id").GetGuid(), body.GetProperty("version").GetString()!, number,
            body.GetProperty("monthlyRentCents").GetInt64());
    }

    // Match production's version wire format for outgoing typed test requests as well.
    private static readonly JsonSerializerOptions WireOptions = new(JsonSerializerDefaults.Web)
    {
        TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver
        { Modifiers = { VersionJsonConverter.Configure } }
    };

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");
    private static async Task<JsonElement> PageAsync(HttpClient client, string path)
    {
        var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await BodyAsync(response);
    }
    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();
    private sealed record TestProperty(Guid Id, string Version, string DisplayAddress);
    private sealed record TestUnit(Guid Id, string Version, string Number, long MonthlyRentCents);
    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 10, 15, 0, 0, 0, TimeSpan.Zero);
    }
}
