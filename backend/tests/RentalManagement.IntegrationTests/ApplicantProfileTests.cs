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
using Microsoft.Extensions.Logging;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Auth;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Services;

namespace RentalManagement.IntegrationTests;

public sealed class ApplicantProfileTests
{
    [SqlServerFact]
    public async Task EndpointsEnforceOwnershipValidationAndSnapshotIndependence()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var anonymous = app.GetTestClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/profile")).StatusCode);
        using var manager = await AccountAsync(app, AccountRoles.PropertyManager);
        foreach (var route in new[] { "applicant-information", "residence-history" })
            Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(manager, route, "{}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync("/api/me/profile")).StatusCode);

        using var applicant = await AccountAsync(app, AccountRoles.Applicant);
        using var other = await AccountAsync(app, AccountRoles.Applicant);
        var original = await ReadAsync(applicant);
        Assert.Equal("1", original.GetProperty("version").GetString());
        Assert.Empty(original.GetProperty("residenceHistory").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, original.GetProperty("applicantInformation").GetProperty("name").ValueKind);

        var saved = await PutAsync(applicant, "applicant-information", """
            {"expectedVersion":"1","applicantInformation":{"name":" Alice ","phone":" ","contactEmail":"contact@example.com","currentAddress":{"line2":" "}}}
            """);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var result = await JsonAsync(saved);
        Assert.Equal("2", result.GetProperty("version").GetString());
        Assert.Equal("Alice", result.GetProperty("applicantInformation").GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, result.GetProperty("applicantInformation").GetProperty("phone").ValueKind);
        Assert.Equal("1", (await ReadAsync(other)).GetProperty("version").GetString());

        var invalid = await PutAsync(applicant, "applicant-information", """
            {"expectedVersion":"2","applicantInformation":{"phone":"123"}}
            """);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
        Assert.Equal("application/problem+json", invalid.Content.Headers.ContentType?.MediaType);
        Assert.True((await JsonAsync(invalid)).GetProperty("validation").GetProperty("fields").TryGetProperty("applicantInformation.phone", out _));
        Assert.Equal("2", (await ReadAsync(applicant)).GetProperty("version").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await PutAsync(applicant, "residence-history", """
            {"expectedVersion":2,"residenceHistory":[]}
            """)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await PutAsync(applicant, "residence-history", """
            {"expectedVersion":"1","residenceHistory":[]}
            """)).StatusCode);

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await db.RentalApplications.AnyAsync(a => a.ApplicantName == "Alice"));
        var profile = await db.ApplicantProfiles.SingleAsync(p => p.Name == "Alice");
        Assert.Null(profile.Phone);
        Assert.Null(profile.CurrentAddress.Line2);
        Assert.True(profile.UpdatedAt >= profile.CreatedAt);
        Assert.NotEqual(profile.ContactEmail, (await db.Users.SingleAsync(u => u.Id == profile.ApplicantId)).Email);
    }

    [SqlServerFact]
    public async Task ResidenceReplacementIsOrderedAtomicAndSharesVersionAcrossSections()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var applicant = await AccountAsync(app, AccountRoles.Applicant);
        var response = await PutAsync(applicant, "residence-history", """
            {"expectedVersion":"1","residenceHistory":[
              {"address":{"streetAddress":"Later"},"landlordName":"Owner","landlordPhone":"123-456-7890","moveInDate":"2022-01-01T00:00:00Z","moveOutDate":"2023-01-01T00:00:00Z"},
              {"address":{"streetAddress":"First"},"landlordName":"Owner","landlordPhone":"123-456-7890","moveInDate":"2020-01-01T00:00:00Z","moveOutDate":"2021-01-01T00:00:00Z"},
              {"address":{"streetAddress":"Tie"},"landlordName":"Owner","landlordPhone":"123-456-7890","moveInDate":"2020-01-01T00:00:00Z","moveOutDate":"2021-01-01T00:00:00Z"}]}
            """);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rows = (await JsonAsync(response)).GetProperty("residenceHistory").EnumerateArray().ToArray();
        Assert.Equal(new[] { 1, 2, 0 }, rows.Select(r => r.GetProperty("position").GetInt32()));
        Assert.Equal("2020-01-01T00:00:00Z", rows[0].GetProperty("moveInDate").GetString());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await PutAsync(applicant, "residence-history", """
            {"expectedVersion":"2","residenceHistory":[{"moveInDate":"2020-01-01T00:00:00Z","moveOutDate":"2021-01-01T00:00:00Z"}]}
            """)).StatusCode);
        Assert.Equal(3, (await ReadAsync(applicant)).GetProperty("residenceHistory").GetArrayLength());

        var competing = await Task.WhenAll(
            PutAsync(applicant, "applicant-information", """{"expectedVersion":"2","applicantInformation":{"name":"Winner"}}"""),
            PutAsync(applicant, "residence-history", """{"expectedVersion":"2","residenceHistory":[]}"""));
        Assert.Single(competing, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(competing, r => r.StatusCode == HttpStatusCode.Conflict);
        var current = await ReadAsync(applicant);
        Assert.Equal("3", current.GetProperty("version").GetString());
        Assert.Equal(HttpStatusCode.OK, (await PutAsync(applicant, "residence-history", """{"expectedVersion":"3","residenceHistory":[]}""")).StatusCode);
        current = await ReadAsync(applicant);
        Assert.Equal("4", current.GetProperty("version").GetString());
        Assert.Empty(current.GetProperty("residenceHistory").EnumerateArray());
        // No-op replacement must still advance the version.
        Assert.Equal(HttpStatusCode.OK, (await PutAsync(applicant, "residence-history", """{"expectedVersion":"4","residenceHistory":[]}""")).StatusCode);
        Assert.Equal("5", (await ReadAsync(applicant)).GetProperty("version").GetString());
    }

    [SqlServerFact]
    public async Task DatabaseFailureRollsBackResidenceDeletionAndProfileVersion()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var app = await StartAsync(fixture);
        using var applicant = await AccountAsync(app, AccountRoles.Applicant);
        var baseline = await PutAsync(applicant, "residence-history", """
            {"expectedVersion":"1","residenceHistory":[
              {"address":{"streetAddress":"Preserved street"},"landlordName":"Owner","landlordPhone":"123-456-7890","moveInDate":"2020-01-01T00:00:00Z","moveOutDate":"2021-01-01T00:00:00Z"}]}
            """);
        Assert.Equal(HttpStatusCode.OK, baseline.StatusCode);
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // Inject a database-only rejection in this disposable test database, after validation
            // and the aggregate update succeed, to exercise transaction rollback.
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE [ProfileResidences] ADD CONSTRAINT [CK_TestResidenceFailure] CHECK ([LandlordName] <> N'RejectTestResidence')");
        }
        var rejected = await PutAsync(applicant, "residence-history", """
            {"expectedVersion":"2","residenceHistory":[
              {"address":{"streetAddress":"Replacement street"},"landlordName":"RejectTestResidence","landlordPhone":"123-456-7890","moveInDate":"2020-01-01T00:00:00Z","moveOutDate":"2021-01-01T00:00:00Z"}]}
            """);
        Assert.Equal(HttpStatusCode.InternalServerError, rejected.StatusCode);
        Assert.Equal("UnexpectedError", (await JsonAsync(rejected)).GetProperty("code").GetString());
        Assert.DoesNotContain("RejectTestResidence", await rejected.Content.ReadAsStringAsync());
        var current = await ReadAsync(applicant);
        Assert.Equal("2", current.GetProperty("version").GetString());
        var row = Assert.Single(current.GetProperty("residenceHistory").EnumerateArray());
        Assert.Equal("Preserved street", row.GetProperty("address").GetProperty("streetAddress").GetString());
    }

    private static async Task<WebApplication> StartAsync(StartupSeedingTests.DatabaseFixture fixture)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddConfiguration(fixture.Configuration);
        builder.Logging.ClearProviders();
        builder.Services.AddApplication(builder.Configuration, builder.Environment);
        builder.Services.AddControllers().AddApplicationPart(typeof(ApplicantProfileController).Assembly);
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
        const string password = "Profile test password";
        var signup = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest(email, password, role));
        Assert.Equal(HttpStatusCode.Created, signup.StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var token = (await JsonAsync(login)).GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static Task<HttpResponseMessage> PutAsync(HttpClient client, string section, string json) =>
        client.PutAsync("/api/me/profile/" + section, new StringContent(json, Encoding.UTF8, "application/json"));
    private static async Task<JsonElement> ReadAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/me/profile");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }
    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();
}
