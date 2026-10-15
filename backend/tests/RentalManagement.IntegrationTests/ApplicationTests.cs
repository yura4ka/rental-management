using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Auth;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.IntegrationTests;

public sealed class ApplicationTests
{
    [SqlServerFact]
    public async Task ApplicantWorkflowEnforcesAuthorizationAcceptedSectionsAndSharedVersions()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (applicant, _) = await test.AccountAsync(AccountRoles.Applicant);
        var (other, _) = await test.AccountAsync(AccountRoles.Applicant);
        var (manager, _) = await test.AccountAsync(AccountRoles.PropertyManager);
        var unit = await test.UnitAsync(ownerId);
        using var anonymous = test.App.GetTestClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/applications")).StatusCode);
        var id = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await applicant.PostAsJsonAsync("/api/applications",
            new { id, unitId = unit, applicantInformation = new { name = "Incomplete" } })).StatusCode);
        await test.CreateApplicationAsync(applicant, unit, id);
        Assert.Equal(HttpStatusCode.Conflict, (await applicant.PostAsJsonAsync("/api/applications",
            new { id = Guid.NewGuid(), unitId = unit, applicantInformation = Info() })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/applications/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync($"/api/applications/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.PutAsJsonAsync($"/api/applications/{id}/residence-history",
            new { expectedVersion = "1", residenceHistory = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Action(applicant, id, "submit", "1")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await applicant.PutAsJsonAsync($"/api/applications/{id}/residence-history",
            new { expectedVersion = "1", residenceHistory = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Action(applicant, id, "submit", "1")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(applicant, id, "submit", "2")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Action(manager, id, "start-review", "3")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, id, "start-review", "3")).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Action(owner, id, "return", "4", " ")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, id, "return", "4", "Please update contact details.")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await applicant.PutAsJsonAsync($"/api/applications/{id}/applicant-information",
            new { expectedVersion = "5", applicantInformation = Info() })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(applicant, id, "submit", "6")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(applicant, id, "withdraw", "7")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Action(applicant, id, "submit", "8")).StatusCode);
        var detail = await Read(applicant, id);
        Assert.Equal("Withdrawn", detail.GetProperty("application").GetProperty("status").GetString());
        Assert.Equal(6, detail.GetProperty("history").GetArrayLength());
        Assert.Equal(0, detail.GetProperty("residenceHistory").GetArrayLength());
        Assert.NotEqual(JsonValueKind.Null, detail.GetProperty("residenceHistorySavedAt").ValueKind);
        Assert.Equal(0, (await Json(await other.GetAsync("/api/applications"))).GetProperty("total").GetInt32());
    }

    [SqlServerFact]
    public async Task CompetingApprovalsIssueOnlyOneLeaseAndLeaveOtherApplicationsUnchanged()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (first, _) = await test.AccountAsync(AccountRoles.Applicant);
        var (second, _) = await test.AccountAsync(AccountRoles.Applicant);
        var unit = await test.UnitAsync(ownerId);
        var a = await test.ReviewApplicationAsync(owner, first, unit);
        var b = await test.ReviewApplicationAsync(owner, second, unit);
        var results = await Task.WhenAll(Action(owner, a, "approve", "4"), Action(owner, b, "approve", "4"));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        var details = await Task.WhenAll(Read(first, a), Read(second, b));
        var approved = Assert.Single(details, d => d.GetProperty("application").GetProperty("status").GetString() == "Approved");
        var unchanged = Assert.Single(details, d => d.GetProperty("application").GetProperty("status").GetString() == "InReview");
        Assert.Equal("4", unchanged.GetProperty("application").GetProperty("version").GetString());
        var lease = approved.GetProperty("lease");
        var approvedAt = lease.GetProperty("approvedAt").GetDateTimeOffset();
        var start = DateOnly.FromDateTime(approvedAt.UtcDateTime);
        Assert.Equal(start.ToString("yyyy-MM-dd") + "T00:00:00Z", lease.GetProperty("startDate").GetString());
        Assert.Equal(start.AddMonths(12).ToString("yyyy-MM-dd") + "T00:00:00Z", lease.GetProperty("endDateExclusive").GetString());
        await using var scope = test.App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.Leases.CountAsync(l => l.ApplicationId == a || l.ApplicationId == b));
        Assert.Equal(start.AddMonths(12), (await db.UnitLeaseGuards.SingleAsync(g => g.UnitId == unit)).ConfirmedLeaseEndExclusive);
        var (third, _) = await test.AccountAsync(AccountRoles.Applicant);
        Assert.Equal(HttpStatusCode.Conflict, (await third.PostAsJsonAsync("/api/applications",
            new { id = Guid.NewGuid(), unitId = unit, applicantInformation = Info() })).StatusCode);
    }

    [SqlServerFact]
    public async Task NotesArePrivateIndependentAndSupportEmptyClearingAtAnyStatus()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (other, _) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (applicant, _) = await test.AccountAsync(AccountRoles.Applicant);
        var unit = await test.UnitAsync(ownerId);
        var id = await test.CreateApplicationAsync(applicant, unit);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/applications/{id}/my-note", new { body = "Missing version" })).StatusCode);
        var competing = await Task.WhenAll(
            owner.PutAsJsonAsync($"/api/applications/{id}/my-note", new { expectedVersion = (string?)null, body = "First" }),
            owner.PutAsJsonAsync($"/api/applications/{id}/my-note", new { expectedVersion = (string?)null, body = "Second" }));
        Assert.Single(competing, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(competing, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.OK, (await other.PutAsJsonAsync($"/api/applications/{id}/my-note", new { expectedVersion = (string?)null, body = "Other manager's note" })).StatusCode);
        Assert.Equal("Other manager's note", (await Read(other, id)).GetProperty("myNote").GetProperty("body").GetString());
        Assert.Equal(JsonValueKind.Null, (await Read(applicant, id)).GetProperty("myNote").ValueKind);
        Assert.Equal("1", (await Read(owner, id)).GetProperty("application").GetProperty("version").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Action(applicant, id, "withdraw", "1")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync($"/api/applications/{id}/my-note", new { expectedVersion = "1", body = "" })).StatusCode);
        var detail = await Read(owner, id);
        Assert.Equal("", detail.GetProperty("myNote").GetProperty("body").GetString());
        Assert.Equal("2", detail.GetProperty("myNote").GetProperty("version").GetString());
        Assert.Equal(2, detail.GetProperty("history").GetArrayLength());
        Assert.DoesNotContain("myNote", await (await owner.GetAsync("/api/applications")).Content.ReadAsStringAsync());
    }

    [SqlServerFact]
    public async Task ArchivedApplicationsKeepWorkflowsAndBulkRejectionDeniesEveryOpenStatusOnly()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (otherManager, _) = await test.AccountAsync(AccountRoles.PropertyManager);
        var unit = await test.UnitAsync(ownerId);
        var applications = new List<Guid>();
        for (var i = 0; i < 5; i++)
        {
            var (applicant, _) = await test.AccountAsync(AccountRoles.Applicant);
            var id = await test.CreateApplicationAsync(applicant, unit);
            applications.Add(id);
            if (i == 0) continue; // Never-saved Draft must also be deniable.
            await applicant.PutAsJsonAsync($"/api/applications/{id}/residence-history", new { expectedVersion = "1", residenceHistory = Array.Empty<object>() });
            await Action(applicant, id, "submit", "2");
            if (i == 1) continue;
            await Action(owner, id, "start-review", "3");
            if (i == 2) continue;
            await Action(owner, id, i == 3 ? "return" : "deny", "4", "Review decision");
        }
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var row = await db.Units.SingleAsync(u => u.Id == unit);
            row.ArchivedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }
        var before = await Read(owner, applications[4]);
        Assert.Equal(HttpStatusCode.Forbidden, (await otherManager.PostAsJsonAsync($"/api/units/{unit}/applications/reject-all", new { comment = "Close" })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await owner.PostAsJsonAsync($"/api/units/{unit}/applications/reject-all", new { comment = " " })).StatusCode);
        var result = await owner.PostAsJsonAsync($"/api/units/{unit}/applications/reject-all", new { comment = "Unit no longer offered" });
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        Assert.Equal(4, (await Json(result)).GetProperty("affectedCount").GetInt32());
        for (var i = 0; i < 4; i++)
        {
            var detail = await Read(owner, applications[i]);
            Assert.Equal("Denied", detail.GetProperty("application").GetProperty("status").GetString());
            Assert.Equal("Unit no longer offered", detail.GetProperty("history").EnumerateArray().Last().GetProperty("comment").GetString());
        }
        Assert.Equal(before.GetProperty("application").GetProperty("version").GetString(),
            (await Read(owner, applications[4])).GetProperty("application").GetProperty("version").GetString());
        Assert.Equal(0, (await Json(await owner.PostAsJsonAsync($"/api/units/{unit}/applications/reject-all", new { comment = "Again" }))).GetProperty("affectedCount").GetInt32());
        var property = (await Read(owner, applications[0])).GetProperty("application").GetProperty("propertyId").GetGuid();
        Assert.Equal(0, (await Json(await owner.GetAsync($"/api/applications?propertyId={property}"))).GetProperty("total").GetInt32());
        Assert.Equal(5, (await Json(await owner.GetAsync($"/api/applications?propertyId={property}&showArchived=true"))).GetProperty("total").GetInt32());
    }

    [SqlServerFact]
    public async Task BulkFailureRollsBackAllStatusesVersionsAndHistory()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (first, _) = await test.AccountAsync(AccountRoles.Applicant);
        var (second, _) = await test.AccountAsync(AccountRoles.Applicant);
        var unit = await test.UnitAsync(ownerId);
        var a = await test.CreateApplicationAsync(first, unit);
        var b = await test.CreateApplicationAsync(second, unit);
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE [ApplicationStatusHistory] ADD CONSTRAINT [CK_TestBulkFailure] CHECK ([Comment] IS NULL OR [Comment] <> N'RejectThisBatch')");
        }
        Assert.Equal(HttpStatusCode.InternalServerError, (await owner.PostAsJsonAsync($"/api/units/{unit}/applications/reject-all", new { comment = "RejectThisBatch" })).StatusCode);
        foreach (var id in new[] { a, b })
        {
            var detail = await Read(owner, id);
            Assert.Equal("Draft", detail.GetProperty("application").GetProperty("status").GetString());
            Assert.Equal("1", detail.GetProperty("application").GetProperty("version").GetString());
            Assert.Single(detail.GetProperty("history").EnumerateArray());
        }
    }

    [SqlServerFact]
    public async Task ArchivedDraftCanSubmitAndBeReviewedButAnActiveLeaseBlocksResubmission()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (first, _) = await test.AccountAsync(AccountRoles.Applicant);
        var (second, _) = await test.AccountAsync(AccountRoles.Applicant);
        var unit = await test.UnitAsync(ownerId);
        var returned = await test.ReviewApplicationAsync(owner, first, unit);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, returned, "return", "4", "Update needed")).StatusCode);
        var draft = await test.CreateApplicationAsync(second, unit);
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var property = await db.Properties.SingleAsync(p => db.Units.Any(u => u.Id == unit && u.PropertyId == p.Id));
            property.ArchivedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.OK, (await second.PutAsJsonAsync($"/api/applications/{draft}/residence-history",
            new { expectedVersion = "1", residenceHistory = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(second, draft, "submit", "2")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, draft, "start-review", "3")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, draft, "release", "4")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, draft, "start-review", "5")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Action(owner, draft, "approve", "6")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Action(first, returned, "submit", "5")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await first.GetAsync("/api/applications")).StatusCode);
        Assert.Equal(1, (await Json(await first.GetAsync("/api/applications"))).GetProperty("total").GetInt32());
    }

    [SqlServerFact]
    public async Task PaginationFiltersAndCanonicalUuidTiesExecuteCorrectlyInSql()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (applicant, applicantId) = await test.AccountAsync(AccountRoles.Applicant);
        var ids = new List<Guid>();
        var now = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        for (var i = 0; i < 23; i++)
        {
            var unit = await test.UnitAsync(ownerId);
            // Mixed leading/trailing components distinguish SQL uniqueidentifier order from text order.
            var id = Guid.Parse($"{i + 1:x8}-0000-0000-0000-{23 - i:x12}");
            ids.Add(id);
            await test.CreateApplicationAsync(applicant, unit, id);
        }
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.RentalApplications.Where(a => a.ApplicantId == applicantId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, now).SetProperty(a => a.StatusChangedAt, now));
        }
        var expected = ids.OrderBy(id => id.ToString(), StringComparer.Ordinal).ToArray();
        foreach (var sort in new[] { "createdAt", "statusChangedAt" })
        foreach (var direction in new[] { "asc", "desc" })
        {
            var page1 = await Json(await applicant.GetAsync($"/api/applications?sortBy={sort}&sortDirection={direction}"));
            var page2 = await Json(await applicant.GetAsync($"/api/applications?page=2&sortBy={sort}&sortDirection={direction}"));
            Assert.Equal(23, page1.GetProperty("total").GetInt32());
            Assert.Equal(20, page1.GetProperty("rows").GetArrayLength());
            Assert.Equal(3, page2.GetProperty("rows").GetArrayLength());
            Assert.Equal(expected, page1.GetProperty("rows").EnumerateArray().Concat(page2.GetProperty("rows").EnumerateArray()).Select(r => r.GetProperty("id").GetGuid()));
        }
        var detail = await Read(applicant, ids[0]);
        var propertyId = detail.GetProperty("application").GetProperty("propertyId").GetGuid();
        Assert.Equal(1, (await Json(await owner.GetAsync($"/api/applications?propertyId={propertyId}&status=Draft"))).GetProperty("total").GetInt32());
        Assert.Equal(0, (await Json(await applicant.GetAsync("/api/applications?status=Approved"))).GetProperty("total").GetInt32());
    }

    [SqlServerFact]
    public async Task BulkRejectionAndApprovalCannotBothTransitionTheSameApplication()
    {
        await using var test = await TestApp.CreateAsync();
        var (owner, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (applicant, _) = await test.AccountAsync(AccountRoles.Applicant);
        var unit = await test.UnitAsync(ownerId);
        var id = await test.ReviewApplicationAsync(owner, applicant, unit);
        var results = await Task.WhenAll(Action(owner, id, "approve", "4"),
            owner.PostAsJsonAsync($"/api/units/{unit}/applications/reject-all", new { comment = "Close all" }));
        Assert.Equal(HttpStatusCode.OK, results[1].StatusCode);
        var detail = await Read(owner, id);
        var status = detail.GetProperty("application").GetProperty("status").GetString();
        Assert.Contains(status, new[] { "Approved", "Denied" });
        Assert.Equal("5", detail.GetProperty("application").GetProperty("version").GetString());
        Assert.Equal(4, detail.GetProperty("history").GetArrayLength());
        Assert.Equal(status == "Approved" ? HttpStatusCode.OK : HttpStatusCode.Conflict, results[0].StatusCode);
        Assert.Equal(status == "Approved" ? 0 : 1, (await Json(results[1])).GetProperty("affectedCount").GetInt32());
        Assert.Equal(status == "Denied", detail.GetProperty("lease").ValueKind == JsonValueKind.Null);
    }

    [SqlServerFact]
    public async Task CompetingCreatesAndSectionSavesHaveOnlyOneWinner()
    {
        await using var test = await TestApp.CreateAsync();
        var (_, ownerId) = await test.AccountAsync(AccountRoles.PropertyManager);
        var (applicant, _) = await test.AccountAsync(AccountRoles.Applicant);
        var unit = await test.UnitAsync(ownerId);
        var creates = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => applicant.PostAsJsonAsync("/api/applications",
            new { id = Guid.NewGuid(), unitId = unit, applicantInformation = Info() })));
        var accepted = Assert.Single(creates, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(creates, r => r.StatusCode == HttpStatusCode.Conflict);
        var id = (await Json(accepted)).GetProperty("application").GetProperty("id").GetGuid();
        var saves = await Task.WhenAll(
            applicant.PutAsJsonAsync($"/api/applications/{id}/applicant-information", new { expectedVersion = "1", applicantInformation = Info() }),
            applicant.PutAsJsonAsync($"/api/applications/{id}/residence-history", new { expectedVersion = "1", residenceHistory = Array.Empty<object>() }));
        Assert.Single(saves, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(saves, r => r.StatusCode == HttpStatusCode.Conflict);
        var detail = await Read(applicant, id);
        Assert.Equal("2", detail.GetProperty("application").GetProperty("version").GetString());
        Assert.Single(detail.GetProperty("history").EnumerateArray());
    }

    private static object Info() => new { name = "Applicant", phone = "123-456-7890", contactEmail = "contact@example.com", currentAddress = new { streetAddress = "Street" } };
    private static Task<HttpResponseMessage> Action(HttpClient client, Guid id, string action, string version, string? comment = null) =>
        client.PostAsJsonAsync($"/api/applications/{id}/{action}", new { expectedVersion = version, comment });
    private static async Task<JsonElement> Read(HttpClient client, Guid id)
    {
        var result = await client.GetAsync($"/api/applications/{id}");
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        return await Json(result);
    }
    private static async Task<JsonElement> Json(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>();

    private sealed class TestApp(StartupSeedingTests.DatabaseFixture fixture, WebApplication app) : IAsyncDisposable
    {
        internal WebApplication App => app;
        private readonly List<HttpClient> clients = [];

        internal static async Task<TestApp> CreateAsync()
        {
            var fixture = new StartupSeedingTests.DatabaseFixture();
            await fixture.InitializeAsync();
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            builder.Configuration.AddConfiguration(fixture.Configuration);
            builder.Logging.ClearProviders();
            builder.Services.AddApplication(builder.Configuration, builder.Environment);
            builder.Services.AddControllers().AddApplicationPart(typeof(ApplicationsController).Assembly);
            var app = builder.Build();
            app.UseMiddleware<ApiErrorMiddleware>();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            app.MapApprovedIdentityEndpoints();
            await app.StartAsync();
            return new(fixture, app);
        }

        internal async Task<(HttpClient, Guid)> AccountAsync(string role)
        {
            var client = app.GetTestClient();
            clients.Add(client);
            var email = Guid.NewGuid().ToString("N") + "@example.com";
            const string password = "Application test password";
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest(email, password, role))).StatusCode);
            var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await Json(login)).GetProperty("accessToken").GetString());
            await using var scope = app.Services.CreateAsyncScope();
            var id = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();
            return (client, id);
        }

        internal async Task<Guid> UnitAsync(Guid owner)
        {
            await using var scope = app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var property = new Property { OwnerManagerId = owner, Address = new() { StreetAddress = "Property street" } };
            var unit = new Unit { PropertyId = property.Id, UnitTypeId = await db.UnitTypes.Where(t => t.IsActive).Select(t => t.Id).FirstAsync(), Number = "TEST", MonthlyRent = 1000 };
            db.Properties.Add(property);
            db.Units.Add(unit);
            db.UnitLeaseGuards.Add(new() { UnitId = unit.Id });
            await db.SaveChangesAsync();
            return unit.Id;
        }

        internal async Task<Guid> CreateApplicationAsync(HttpClient applicant, Guid unit, Guid? suppliedId = null)
        {
            var id = suppliedId ?? Guid.NewGuid();
            var result = await applicant.PostAsJsonAsync("/api/applications", new { id, unitId = unit, applicantInformation = Info() });
            Assert.Equal(HttpStatusCode.Created, result.StatusCode);
            Assert.NotNull(result.Headers.Location);
            return id;
        }

        internal async Task<Guid> ReviewApplicationAsync(HttpClient owner, HttpClient applicant, Guid unit)
        {
            var id = await CreateApplicationAsync(applicant, unit);
            Assert.Equal(HttpStatusCode.OK, (await applicant.PutAsJsonAsync($"/api/applications/{id}/residence-history", new { expectedVersion = "1", residenceHistory = Array.Empty<object>() })).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await Action(applicant, id, "submit", "2")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await Action(owner, id, "start-review", "3")).StatusCode);
            return id;
        }

        public async ValueTask DisposeAsync()
        {
            foreach (var client in clients) client.Dispose();
            await app.DisposeAsync();
            await fixture.DisposeAsync();
        }
    }
}
