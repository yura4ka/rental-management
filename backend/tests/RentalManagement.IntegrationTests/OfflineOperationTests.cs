using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
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

public sealed class OfflineOperationTests
{
    [SqlServerFact]
    public async Task ConcurrentIdenticalRequestsCommitOnceAndReplayTheOriginalSnapshotAfterLaterEdits()
    {
        await using var test = await TestApp.CreateAsync();
        var account = await test.AccountAsync(AccountRoles.PropertyManager);
        var id = Guid.CreateVersion7();
        var request = test.Command(new { id, address = new { streetAddress = "Original street" } });
        var operationId = request["operationId"]!.GetValue<Guid>();
        var responses = await Task.WhenAll(Enumerable.Range(0, 2)
            .Select(_ => Send(account.Client, HttpMethod.Post, "/api/properties", request)));
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        var original = await responses[0].Content.ReadAsStringAsync();
        Assert.Equal(original, await responses[1].Content.ReadAsStringAsync());
        Assert.Equal("1", JsonDocument.Parse(original).RootElement.GetProperty("version").GetString());
        var edit = await Send(account.Client, HttpMethod.Put, $"/api/properties/{id}",
            test.Command(new { expectedVersion = "1", address = new { streetAddress = "Later street" } }));
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
        var replay = await Send(account.Client, HttpMethod.Post, "/api/properties", request);
        Assert.Equal(original, await replay.Content.ReadAsStringAsync());
        var recovery = await account.Client.GetFromJsonAsync<JsonElement>(test.RecoveryPath(operationId));
        Assert.Equal("Accepted", recovery.GetProperty("outcome").GetString());
        Assert.Equal("Original street", recovery.GetProperty("response").GetProperty("address").GetProperty("streetAddress").GetString());
        await using var scope = test.App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.Properties.CountAsync(p => p.Id == id));
        Assert.Equal(1, await db.OperationReceipts.CountAsync(r => r.AccountId == account.Id && r.OperationId == operationId));
        Assert.Equal(2, (await db.Properties.SingleAsync(p => p.Id == id)).Version);
        Assert.False(await db.OperationReceipts.AnyAsync(r => r.Outcome == null));
    }

    [SqlServerFact]
    public async Task RejectionsAreDurableChangedIntentConflictsAndIdsAreAccountScoped()
    {
        await using var test = await TestApp.CreateAsync();
        var account = await test.AccountAsync(AccountRoles.Applicant);
        var other = await test.AccountAsync(AccountRoles.Applicant);
        const string path = "/api/me/profile/residence-history";
        var request = test.Command(new { expectedVersion = "2", residenceHistory = Array.Empty<object>() });
        var operationId = request["operationId"]!.GetValue<Guid>();
        var rejected = await Send(account.Client, HttpMethod.Put, path, request);
        Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
        Assert.Equal("application/problem+json", rejected.Content.Headers.ContentType!.MediaType);
        var original = await rejected.Content.ReadAsStringAsync();
        Assert.Equal("StaleVersion", JsonDocument.Parse(original).RootElement.GetProperty("code").GetString());
        Assert.Equal(operationId, JsonDocument.Parse(original).RootElement.GetProperty("operationId").GetGuid());
        var changed = request.DeepClone().AsObject();
        changed["expectedVersion"] = "1";
        var conflict = await Send(account.Client, HttpMethod.Put, path, changed);
        Assert.Equal("OperationIdConflict", (await Json(conflict)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Send(account.Client, HttpMethod.Put, path,
            test.Command(new { expectedVersion = "1", residenceHistory = Array.Empty<object>() }))).StatusCode);
        // The rejected intention must not execute merely because its version is now current.
        Assert.Equal(original, await (await Send(account.Client, HttpMethod.Put, path, request)).Content.ReadAsStringAsync());
        var recovery = await account.Client.GetFromJsonAsync<JsonElement>(test.RecoveryPath(operationId));
        Assert.Equal("Rejected", recovery.GetProperty("outcome").GetString());
        Assert.Equal(409, recovery.GetProperty("httpStatus").GetInt32());
        var unknown = await other.Client.GetFromJsonAsync<JsonElement>(test.RecoveryPath(operationId));
        Assert.Equal("Unknown", unknown.GetProperty("outcome").GetString());
        // The same operation ID may represent a separate intention for another account.
        Assert.Equal(HttpStatusCode.OK, (await Send(other.Client, HttpMethod.Put, path, changed)).StatusCode);
        await using var scope = test.App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(2, await db.OperationReceipts.CountAsync(r => r.OperationId == operationId));
        Assert.Equal(2, (await db.ApplicantProfiles.SingleAsync(p => p.ApplicantId == account.Id)).Version);
    }

    [SqlServerFact]
    public async Task ValidationRejectionsAreReceiptedButMalformedUnauthorizedAndWrongGenerationRequestsAreNot()
    {
        await using var test = await TestApp.CreateAsync();
        var account = await test.AccountAsync(AccountRoles.Applicant);
        const string path = "/api/me/profile/applicant-information";
        var invalid = test.Command(new { expectedVersion = "1", applicantInformation = new { phone = "bad" } });
        var rejection = await Send(account.Client, HttpMethod.Put, path, invalid);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, rejection.StatusCode);
        var body = await Json(rejection);
        Assert.True(body.GetProperty("validation").GetProperty("fields").TryGetProperty("applicantInformation.phone", out _));
        Assert.Equal(invalid["operationId"]!.GetValue<Guid>(), body.GetProperty("operationId").GetGuid());
        var wrongGeneration = test.Command(new { expectedVersion = "1", applicantInformation = new { name = "A" } });
        wrongGeneration["environmentGeneration"] = Guid.NewGuid();
        var mismatch = await Send(account.Client, HttpMethod.Put, path, wrongGeneration);
        Assert.Equal("EnvironmentGenerationMismatch", (await Json(mismatch)).GetProperty("code").GetString());
        var wrongLookup = await account.Client.GetAsync($"/api/operations/{invalid["operationId"]}?environmentGeneration={Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Conflict, wrongLookup.StatusCode);
        var malformed = test.Command(new { expectedVersion = "1", applicantInformation = new { name = "A" }, extra = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(account.Client, HttpMethod.Put, path, malformed)).StatusCode);
        malformed.Remove("extra");
        malformed.Remove("operationId");
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(account.Client, HttpMethod.Put, path, malformed)).StatusCode);
        using var anonymous = test.App.GetTestClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(anonymous, HttpMethod.Put, path, invalid)).StatusCode);
        await using var scope = test.App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.OperationReceipts.CountAsync(r => r.AccountId == account.Id));
        Assert.Equal(1, (await db.ApplicantProfiles.SingleAsync(p => p.ApplicantId == account.Id)).Version);
    }

    [SqlServerFact]
    public async Task FailedReceiptFinalizationRollsBackBusinessEffectsAndUnfinishedReservation()
    {
        await using var test = await TestApp.CreateAsync();
        var account = await test.AccountAsync(AccountRoles.PropertyManager);
        var id = Guid.CreateVersion7();
        var request = test.Command(new { id, address = new { streetAddress = "Rollback street" } });
        var operationId = request["operationId"]!.GetValue<Guid>();
        await using (var scope = test.App.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.ExecuteSqlRawAsync("""
                ALTER TABLE [OperationReceipts] ADD CONSTRAINT [CK_TestReceiptFailure] CHECK ([Outcome] IS NULL)
                """);
        Assert.Equal(HttpStatusCode.InternalServerError, (await Send(account.Client, HttpMethod.Post, "/api/properties", request)).StatusCode);
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.False(await db.Properties.AnyAsync(p => p.Id == id));
            Assert.False(await db.OperationReceipts.AnyAsync(r => r.AccountId == account.Id && r.OperationId == operationId));
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE [OperationReceipts] DROP CONSTRAINT [CK_TestReceiptFailure]");
        }
        Assert.Equal(HttpStatusCode.Created, (await Send(account.Client, HttpMethod.Post, "/api/properties", request)).StatusCode);
    }

    [SqlServerFact]
    public async Task HistoricalOutcomeRequiresCurrentResourceAuthorizationAndMatchingGeneration()
    {
        await using var test = await TestApp.CreateAsync();
        var owner = await test.AccountAsync(AccountRoles.PropertyManager);
        var nextOwner = await test.AccountAsync(AccountRoles.PropertyManager);
        var id = Guid.CreateVersion7();
        Assert.Equal(HttpStatusCode.Created, (await Send(owner.Client, HttpMethod.Post, "/api/properties",
            test.Command(new { id, address = new { streetAddress = "Property" } }))).StatusCode);
        var edit = test.Command(new { expectedVersion = "1", address = new { streetAddress = "Edited" } });
        Assert.Equal(HttpStatusCode.OK, (await Send(owner.Client, HttpMethod.Put, $"/api/properties/{id}", edit)).StatusCode);
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Properties.Where(p => p.Id == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.OwnerManagerId, nextOwner.Id));
        }
        Assert.Equal(HttpStatusCode.NotFound, (await owner.Client.GetAsync(test.RecoveryPath(edit["operationId"]!.GetValue<Guid>()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(owner.Client, HttpMethod.Put, $"/api/properties/{id}", edit)).StatusCode);
        await using (var scope = test.App.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().DatabaseMetadata
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.EnvironmentGeneration, Guid.NewGuid()));
        var mismatch = await Send(owner.Client, HttpMethod.Put, $"/api/properties/{id}", edit);
        Assert.Equal("EnvironmentGenerationMismatch", (await Json(mismatch)).GetProperty("code").GetString());
    }

    [SqlServerFact]
    public async Task RejectAllSelectsAtFirstExecutionAndIdenticalReplayDoesNotRejectLaterApplications()
    {
        await using var test = await TestApp.CreateAsync();
        var owner = await test.AccountAsync(AccountRoles.PropertyManager);
        var applicant = await test.AccountAsync(AccountRoles.Applicant);
        Guid unitId;
        await using (var scope = test.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var property = new Property { OwnerManagerId = owner.Id, Address = new() { StreetAddress = "Batch property" } };
            var unit = new Unit
            {
                PropertyId = property.Id, Number = "BATCH", MonthlyRent = 1000,
                UnitTypeId = await db.UnitTypes.Where(t => t.IsActive).Select(t => t.Id).FirstAsync()
            };
            db.Properties.Add(property);
            db.Units.Add(unit);
            db.UnitLeaseGuards.Add(new() { UnitId = unit.Id });
            await db.SaveChangesAsync();
            unitId = unit.Id;
        }
        // The frozen batch intentionally carries neither application IDs nor expected versions.
        var batch = test.Command(new { comment = "Batch rejection" });
        var first = await CreateDraft();
        var path = $"/api/units/{unitId}/applications/reject-all";
        var accepted = await Send(owner.Client, HttpMethod.Post, path, batch);
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var original = await accepted.Content.ReadAsStringAsync();
        Assert.Equal(1, JsonDocument.Parse(original).RootElement.GetProperty("affectedCount").GetInt32());
        var later = await CreateDraft();
        var replay = await Send(owner.Client, HttpMethod.Post, path, batch);
        Assert.Equal(original, await replay.Content.ReadAsStringAsync());
        await using var verify = test.App.Services.CreateAsyncScope();
        var context = verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(ApplicationStatus.Denied, (await context.RentalApplications.SingleAsync(a => a.Id == first)).Status);
        Assert.Equal(ApplicationStatus.Draft, (await context.RentalApplications.SingleAsync(a => a.Id == later)).Status);
        var operationId = batch["operationId"]!.GetValue<Guid>();
        Assert.Single(await context.ApplicationStatusHistory.Where(h => h.ApplicationId == first && h.OperationId == operationId).ToListAsync());
        Assert.False(await context.ApplicationStatusHistory.AnyAsync(h => h.ApplicationId == later && h.OperationId == operationId));

        async Task<Guid> CreateDraft()
        {
            var id = Guid.CreateVersion7();
            var result = await Send(applicant.Client, HttpMethod.Post, "/api/applications", test.Command(new
            {
                id, unitId,
                applicantInformation = new
                {
                    name = "Applicant", phone = "123-456-7890", contactEmail = "contact@example.com",
                    currentAddress = new { streetAddress = "Applicant street" }
                }
            }));
            Assert.Equal(HttpStatusCode.Created, result.StatusCode);
            return id;
        }
    }

    [SqlServerFact]
    public async Task LogoutReplayDoesNotRevokeLaterLoginAndRecoveryIsAccountScoped()
    {
        await using var test = await TestApp.CreateAsync();
        var account = await test.AccountAsync(AccountRoles.Applicant);
        var other = await test.AccountAsync(AccountRoles.Applicant);
        var operationId = Guid.CreateVersion7();
        var result = await account.Client.PostAsJsonAsync("/api/auth/logout", new { operationId });
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        var original = await result.Content.ReadAsStringAsync();
        var oldRefresh = await account.Client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = account.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, oldRefresh.StatusCode);
        // Issued access tokens remain valid until expiry, allowing lost-response recovery.
        Assert.Equal(original, await (await account.Client.GetAsync($"/api/auth/logout/{operationId}")).Content.ReadAsStringAsync());
        var unknown = await other.Client.GetFromJsonAsync<JsonElement>($"/api/auth/logout/{operationId}");
        Assert.Equal("Unknown", unknown.GetProperty("outcome").GetString());
        var newLogin = await account.Client.PostAsJsonAsync("/api/auth/login", new { account.Email, password = TestApp.Password });
        var tokens = await Json(newLogin);
        account.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.GetProperty("accessToken").GetString());
        var replays = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => account.Client.PostAsJsonAsync("/api/auth/logout", new { operationId })));
        foreach (var replay in replays) Assert.Equal(original, await replay.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.OK, (await account.Client.PostAsJsonAsync("/api/auth/refresh",
            new { refreshToken = tokens.GetProperty("refreshToken").GetString() })).StatusCode);
        await using var scope = test.App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.LogoutAcknowledgements.CountAsync(a => a.AccountId == account.Id));
        Assert.False(await db.OperationReceipts.AnyAsync(r => r.AccountId == account.Id));
    }

    private static Task<HttpResponseMessage> Send(HttpClient client, HttpMethod method, string path, JsonObject body) =>
        client.SendAsync(new HttpRequestMessage(method, path)
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json")
        });

    private static async Task<JsonElement> Json(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>();
    private sealed record Account(HttpClient Client, Guid Id, string Email, string RefreshToken);

    private sealed class TestApp(StartupSeedingTests.DatabaseFixture fixture, WebApplication app, Guid generation) : IAsyncDisposable
    {
        internal const string Password = "Offline operation test password";
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
            builder.Services.AddControllers().AddApplicationPart(typeof(OperationsController).Assembly);
            var app = builder.Build();
            app.UseMiddleware<ApiErrorMiddleware>();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            app.MapApprovedIdentityEndpoints();
            await app.StartAsync();
            await using var scope = app.Services.CreateAsyncScope();
            var generation = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()
                .DatabaseMetadata.Select(m => m.EnvironmentGeneration).SingleAsync();
            return new(fixture, app, generation);
        }

        internal JsonObject Command(object payload)
        {
            var body = JsonSerializer.SerializeToNode(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web))!.AsObject();
            body["operationId"] = Guid.CreateVersion7();
            body["environmentGeneration"] = generation;
            return body;
        }

        internal string RecoveryPath(Guid operationId) => $"/api/operations/{operationId}?environmentGeneration={generation}";

        internal async Task<Account> AccountAsync(string role)
        {
            var client = app.GetTestClient();
            clients.Add(client);
            var email = Guid.NewGuid().ToString("N") + "@example.com";
            var signup = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest(email, Password, role));
            Assert.Equal(HttpStatusCode.Created, signup.StatusCode);
            var id = (await Json(signup)).GetProperty("id").GetGuid();
            var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            var tokens = await Json(login);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.GetProperty("accessToken").GetString());
            return new(client, id, email, tokens.GetProperty("refreshToken").GetString()!);
        }

        public async ValueTask DisposeAsync()
        {
            foreach (var client in clients) client.Dispose();
            await app.DisposeAsync();
            await fixture.DisposeAsync();
        }
    }
}
