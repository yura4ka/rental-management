using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;
using Swashbuckle.AspNetCore.Swagger;

namespace RentalManagement.UnitTests;

public sealed class ProfileOpenApiTests
{
    [Fact]
    public async Task SwaggerPublishesOnlyTheThreeProfileRoutesWithStringVersionsAndCalendarDates()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(ApplicantProfileController).Assembly);
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Test", Version = "v1" });
            options.SchemaFilter<VersionOpenApiFilter>();
            options.SchemaFilter<ProfileOpenApiFilter>();
        });
        await using var app = builder.Build();
        var document = app.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
        Assert.Equal(3, document.Paths.Keys.Count(p => p.StartsWith("/api/me/profile", StringComparison.Ordinal)));
        Assert.Contains("/api/me/profile", document.Paths.Keys);
        Assert.Contains("/api/me/profile/applicant-information", document.Paths.Keys);
        Assert.Contains("/api/me/profile/residence-history", document.Paths.Keys);
        foreach (var name in new[] { "ApplicantInformationRequest", "ResidenceHistoryRequest" })
        {
            var version = document.Components!.Schemas![name].Properties!["expectedVersion"];
            Assert.Equal(JsonSchemaType.String, version.Type);
            Assert.Equal("^[1-9][0-9]*$", version.Pattern);
        }
        Assert.Equal(JsonSchemaType.String, document.Components!.Schemas!["ApplicantProfileResponse"].Properties!["version"].Type);
        foreach (var name in new[] { "ResidenceInput", "ResidenceResponse" })
            Assert.Equal(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00Z$", document.Components.Schemas[name].Properties!["moveInDate"].Pattern);
        var policy = Assert.Single(typeof(ApplicantProfileController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Equal(AccountRoles.Applicant, policy.Policy);
    }

    [Fact]
    public async Task AllControllerResponsesDistinguishSecurityFailuresFromProblemDetailsErrors()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(ApplicantProfileController).Assembly);
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Test", Version = "v1" }));
        await using var app = builder.Build();
        var document = app.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");

        // This document contains controller routes only, not Identity's native login/refresh endpoints.
        foreach (var (path, item) in document.Paths)
        foreach (var (method, operation) in item.Operations!)
        foreach (var (status, response) in operation.Responses!)
        {
            if (status is "401" or "403" or "204")
            {
                Assert.True(response.Content is null || response.Content.Count == 0,
                    $"{method} {path}: {status} must not promise a response body.");
                continue;
            }

            var expected = status.StartsWith('2') ? "application/json" : "application/problem+json";
            var content = Assert.Single(response.Content!);
            Assert.True(content.Key == expected,
                $"{method} {path}: {status} documents {content.Key}, expected {expected}.");
            Assert.NotNull(content.Value.Schema);
        }
    }
}
