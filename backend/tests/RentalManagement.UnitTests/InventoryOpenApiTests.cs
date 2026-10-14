using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;
using Swashbuckle.AspNetCore.Swagger;

namespace RentalManagement.UnitTests;

public sealed class InventoryOpenApiTests
{
    [Fact]
    public async Task InventoryRoutesExposeSupportedMethodsSchemasAndPolicies()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(PropertiesController).Assembly);
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Test", Version = "v1" });
            options.SchemaFilter<VersionOpenApiFilter>();
            options.SchemaFilter<InventoryOpenApiFilter>();
        });
        await using var app = builder.Build();
        var document = app.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
        foreach (var path in new[] { "/api/properties", "/api/properties/{id}", "/api/properties/{id}/archive",
            "/api/properties/{propertyId}/units", "/api/properties/{propertyId}/units/{id}",
            "/api/properties/{propertyId}/units/{id}/archive", "/api/available-units", "/api/unit-types" })
        {
            Assert.Contains(path, document.Paths.Keys);
            Assert.DoesNotContain(System.Net.Http.HttpMethod.Delete, document.Paths[path].Operations!.Keys);
            foreach (var operation in document.Paths[path].Operations!.Values)
                Assert.Contains("401", operation.Responses!.Keys);
        }
        foreach (var (path, method, statuses) in new[]
        {
            ("/api/properties", HttpMethod.Get, "200,400,401,403,422,500"),
            ("/api/properties", HttpMethod.Post, "201,400,401,403,422,500"),
            ("/api/properties/{id}", HttpMethod.Put, "200,400,401,403,404,409,422,500,503"),
            ("/api/properties/{id}/archive", HttpMethod.Post, "200,400,401,403,404,409,422,500,503"),
            ("/api/properties/{propertyId}/units", HttpMethod.Get, "200,400,401,403,404,422,500"),
            ("/api/properties/{propertyId}/units", HttpMethod.Post, "201,400,401,403,404,409,422,500,503"),
            ("/api/properties/{propertyId}/units/{id}", HttpMethod.Put, "200,400,401,403,404,409,422,500,503"),
            ("/api/properties/{propertyId}/units/{id}/archive", HttpMethod.Post, "200,400,401,403,404,409,422,500,503"),
            ("/api/available-units", HttpMethod.Get, "200,400,401,403,422,500"),
            ("/api/unit-types", HttpMethod.Get, "200,401,403,500")
        })
        {
            var responses = document.Paths[path].Operations![method].Responses!;
            Assert.Equal(statuses.Split(','), responses.Keys.Order());
            foreach (var (status, response) in responses)
            {
                if (status is "401" or "403")
                {
                    Assert.True(response.Content is null || response.Content.Count == 0,
                        $"{method} {path}: response {status} should not promise a response body.");
                    continue;
                }
                var expected = status.StartsWith('2') ? "application/json" : "application/problem+json";
                var actual = Assert.Single(response.Content!).Key;
                Assert.True(actual == expected, $"{method} {path}: response {status} documents {actual}, expected {expected}.");
            }
        }
        foreach (var name in new[] { "UpdatePropertyRequest", "UpdateUnitRequest", "ArchiveInventoryRequest" })
            Assert.Equal(JsonSchemaType.String, document.Components!.Schemas![name].Properties!["expectedVersion"].Type);
        foreach (var name in new[] { "PropertyResponse", "UnitResponse", "UnitTypeResponse" })
            Assert.Equal(JsonSchemaType.String, document.Components!.Schemas![name].Properties!["version"].Type);
        var unit = document.Components!.Schemas!["CreateUnitRequest"];
        Assert.Equal(JsonSchemaType.Integer | JsonSchemaType.Null, unit.Properties!["monthlyRentCents"].Type);
        Assert.Equal("999999999999", unit.Properties["monthlyRentCents"].Maximum);
        Assert.Equal("^[A-Z0-9_-]{1,20}$", unit.Properties["number"].Pattern);
        foreach (var type in new[] { typeof(PropertiesController), typeof(UnitsController) })
            Assert.Contains(type.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(),
                a => a.Policy == AccountRoles.PropertyManager);
        Assert.NotEmpty(typeof(InventoryBrowseController).GetCustomAttributes(typeof(AuthorizeAttribute), true));
        foreach (var type in new[] { typeof(PropertiesController), typeof(UnitsController), typeof(InventoryBrowseController) })
        {
            Assert.Equal(typeof(ControllerBase), type.BaseType);
            Assert.Single(type.GetCustomAttributes(typeof(ApiControllerAttribute), false));
            Assert.Empty(type.GetCustomAttributes(typeof(ProducesAttribute), false));
        }
    }
}
