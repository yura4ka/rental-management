using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;
using Swashbuckle.AspNetCore.Swagger;

namespace RentalManagement.UnitTests;

public sealed class ApplicationOpenApiTests
{
    [Fact]
    public async Task DocumentsAllApplicationEndpointsAndIndependentNullableNoteVersions()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(ApplicationsController).Assembly);
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Test", Version = "v1" });
            options.SchemaFilter<VersionOpenApiFilter>();
            options.SchemaFilter<ProfileOpenApiFilter>();
            options.SchemaFilter<ApplicationOpenApiFilter>();
        });
        await using var app = builder.Build();
        var doc = app.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
        Assert.Contains("/api/applications", doc.Paths.Keys);
        Assert.Contains("/api/applications/{id}", doc.Paths.Keys);
        foreach (var action in new[] { "submit", "withdraw", "start-review", "release", "return", "deny", "approve", "my-note", "applicant-information", "residence-history" })
            Assert.Contains("/api/applications/{id}/" + action, doc.Paths.Keys);
        Assert.Contains("/api/units/{unitId}/applications/reject-all", doc.Paths.Keys);
        var list = doc.Paths["/api/applications"].Operations![System.Net.Http.HttpMethod.Get];
        Assert.Equal(new[] { "page", "propertyId", "showArchived", "sortBy", "sortDirection", "status" },
            list.Parameters!.Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal));
        var schemas = doc.Components!.Schemas!;
        Assert.Equal(JsonSchemaType.String, schemas["ApplicationActionRequest"].Properties!["expectedVersion"].Type);
        Assert.Equal(JsonSchemaType.String, schemas["ApplicationRow"].Properties!["version"].Type);
        Assert.Equal(JsonSchemaType.String, schemas["ManagerNoteResponse"].Properties!["version"].Type);
        var note = schemas["SaveManagerNoteRequest"];
        Assert.Contains("expectedVersion", note.Required!);
        Assert.Equal(JsonSchemaType.String | JsonSchemaType.Null, note.Properties!["expectedVersion"].Type);
        Assert.Equal(2000, note.Properties["body"].MaxLength);
        Assert.Equal(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00Z$", schemas["ApplicationLeaseResponse"].Properties!["endDateExclusive"].Pattern);
        Assert.Equal("application/json", Assert.Single(doc.Paths["/api/applications"].Operations![System.Net.Http.HttpMethod.Post].Responses!["201"].Content!).Key);
    }
}
