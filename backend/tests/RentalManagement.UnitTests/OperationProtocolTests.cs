using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Operations;
using RentalManagement.Api.Persistence;
using Swashbuckle.AspNetCore.Swagger;

namespace RentalManagement.UnitTests;

public sealed class OperationProtocolTests
{
    private static JsonSerializerOptions Options() => new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        TypeInfoResolver = new DefaultJsonTypeInfoResolver
        {
            Modifiers = { VersionJsonConverter.Configure, ServiceConfiguration.ConfigureCommandJson }
        }
    };

    private static byte[] Fingerprint(string json, string command = "Applications.Submit", string id = "target")
    {
        using var body = JsonDocument.Parse(json);
        return CommandFingerprint.Compute(command, "Application", id, new Dictionary<string, string> { ["id"] = id }, body.RootElement);
    }

    [Fact]
    public void FingerprintsIgnoreObjectOrderAndWhitespaceButNotArrayOrderOrMissingNull()
    {
        Assert.Equal(Fingerprint("""{"b":{"y":2,"x":1},"a":[1,2]}"""),
            Fingerprint("""{ "a": [1, 2], "b": {"x": 1, "y": 2} }"""));
        Assert.NotEqual(Fingerprint("""{"a":[1,2]}"""), Fingerprint("""{"a":[2,1]}"""));
        Assert.NotEqual(Fingerprint("{}"), Fingerprint("""{"a":null}"""));
        Assert.NotEqual(Fingerprint("{}"), Fingerprint("{}", command: "Applications.Withdraw"));
        Assert.NotEqual(Fingerprint("{}"), Fingerprint("{}", id: "another"));
        Assert.NotEqual(Fingerprint("""{"expectedVersion":"1"}"""), Fingerprint("""{"expectedVersion":"2"}"""));
        Assert.NotEqual(Fingerprint("""{"comment":"x"}"""), Fingerprint("""{"comment":" x "}"""));
        Assert.Equal(32, Fingerprint("{}").Length);
    }

    [Fact]
    public void DuplicateJsonKeysAreMalformedIncludingNestedDuplicates()
    {
        Assert.Equal(400, Assert.Throws<ApiException>(() => Fingerprint("""{"a":1,"a":2}""")).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => Fingerprint("""{"a":[{"b":1,"b":2}]}""")).Status);
    }

    [Fact]
    public void MetadataAndExpectedVersionsAreRequiredAndUnknownMembersAreRejected()
    {
        var options = Options();
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ResidenceHistoryRequest>("""{"expectedVersion":"1","residenceHistory":[]}""", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ResidenceHistoryRequest>(OperationTestJson.WithMetadata("""{"residenceHistory":[]}"""), options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ResidenceHistoryRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":1,"residenceHistory":[]}"""), options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ResidenceHistoryRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":"1","residenceHistory":[],"extra":1}"""), options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ApplicantInformationRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":"1","applicantInformation":{"name":"A","extra":1}}"""), options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CreatePropertyRequest>(OperationTestJson.WithMetadata("""{"address":{"streetAddress":"Street"}}"""), options));
        var note = JsonSerializer.Deserialize<SaveManagerNoteRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":null,"body":""}"""), options)!;
        Assert.Null(note.ExpectedVersion);
        var request = JsonSerializer.Deserialize<ResidenceHistoryRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":"9223372036854775807","residenceHistory":[]}"""), options)!;
        Assert.Equal(long.MaxValue, request.ExpectedVersion);
    }

    [Fact]
    public void CommandsRequireVersion7UuidsAndFinalReceipts()
    {
        CommandRunner.RequireUuid7(Guid.CreateVersion7(), "operationId");
        Assert.Throws<ApiException>(() => CommandRunner.RequireUuid7(Guid.Empty, "operationId"));
        Assert.Throws<ApiException>(() => CommandRunner.RequireUuid7(Guid.NewGuid(), "operationId"));
        Assert.Throws<InvalidOperationException>(() => CommandRunner.RequireFinal(new OperationReceipt()));
    }

    [Fact]
    public void ReceiptKeysAndHistoryUniquenessAreAccountAndAggregateScoped()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=True").Options);
        var receipt = db.Model.FindEntityType(typeof(OperationReceipt))!;
        Assert.Equal(new[] { "AccountId", "OperationId" }, receipt.FindPrimaryKey()!.Properties.Select(p => p.Name));
        Assert.Equal("uniqueidentifier", receipt.FindProperty("AccountId")!.GetColumnType());
        Assert.Empty(receipt.GetIndexes());
        Assert.Equal("binary(32)", receipt.FindProperty("RequestFingerprint")!.GetColumnType());
        Assert.Contains(db.Model.FindEntityType(typeof(ApplicationStatusHistory))!.GetIndexes(), i =>
            i.IsUnique && i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ApplicationId", "OperationId" }));
        var logout = db.Model.FindEntityType(typeof(LogoutAcknowledgement))!;
        Assert.Empty(logout.GetIndexes());
        Assert.Equal("uniqueidentifier", logout.FindProperty("AccountId")!.GetColumnType());
    }

    [Fact]
    public void FinalReceiptsAndLogoutAcknowledgementsCannotBeModifiedOrDeletedThroughTheContext()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=True").Options);
        var receipt = new OperationReceipt
        {
            AccountId = Guid.NewGuid(), OperationId = Guid.CreateVersion7(), Outcome = "Accepted"
        };
        db.Attach(receipt);
        receipt.Code = "Changed";
        Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
        db.ChangeTracker.Clear();
        var acknowledgement = new LogoutAcknowledgement
        {
            AccountId = Guid.NewGuid(), OperationId = Guid.CreateVersion7(), AcknowledgedAt = DateTimeOffset.UtcNow
        };
        db.Attach(acknowledgement);
        db.Remove(acknowledgement);
        Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
    }

    [Fact]
    public void EveryBusinessMutationParticipatesInTheOperationProtocol()
    {
        var controllers = typeof(OperationsController).Assembly.GetTypes()
            .Where(t => t.BaseType == typeof(Microsoft.AspNetCore.Mvc.ControllerBase) && t != typeof(AuthController));
        foreach (var controller in controllers)
            foreach (var action in controller.GetMethods().Where(m => m.GetCustomAttributes(true)
                .OfType<Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute>()
                .Any(a => a.HttpMethods.Any(v => v is "POST" or "PUT" or "PATCH" or "DELETE"))))
                Assert.Contains(action.GetParameters(), p => typeof(OperationRequest).IsAssignableFrom(p.ParameterType));
    }

    [Fact]
    public async Task OpenApiDocumentsRequiredMetadataRecoveryAndLogoutAcknowledgements()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(OperationsController).Assembly);
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Test", Version = "v1" });
            options.SchemaFilter<VersionOpenApiFilter>();
            options.SchemaFilter<OperationOpenApiFilter>();
            options.OperationFilter<OperationOpenApiFilter>();
        });
        await using var app = builder.Build();
        var doc = app.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
        Assert.Contains("/api/operations/{operationId}", doc.Paths.Keys);
        Assert.Contains("/api/auth/logout/{operationId}", doc.Paths.Keys);
        var schemas = doc.Components!.Schemas!;
        foreach (var type in new[] { "CreatePropertyRequest", "CreateUnitRequest", "CreateApplicationRequest", "ResidenceHistoryRequest", "RejectAllApplicationsRequest" })
        {
            Assert.Contains("operationId", schemas[type].Required!);
            Assert.Contains("environmentGeneration", schemas[type].Required!);
        }
        Assert.Contains("id", schemas["CreatePropertyRequest"].Required!);
        Assert.Contains("expectedVersion", schemas["ResidenceHistoryRequest"].Required!);
        Assert.DoesNotContain("expectedVersion", schemas["RejectAllApplicationsRequest"].Properties!.Keys);
        Assert.Contains("affectedResources", schemas["PropertyResponse"].Properties!.Keys);
        Assert.Equal(JsonSchemaType.String | JsonSchemaType.Null, schemas["AffectedResource"].Properties!["version"].Type);
        var create = doc.Paths["/api/properties"].Operations![HttpMethod.Post];
        Assert.Contains("409", create.Responses!.Keys);
        Assert.Contains("503", create.Responses.Keys);
        Assert.Equal("application/problem+json", Assert.Single(create.Responses["409"].Content!).Key);
        var logout = doc.Paths["/api/auth/logout"].Operations![HttpMethod.Post];
        Assert.Contains("200", logout.Responses!.Keys);
        Assert.DoesNotContain("204", logout.Responses.Keys);
        Assert.Equal("application/json", Assert.Single(logout.Responses["200"].Content!).Key);
    }
}
