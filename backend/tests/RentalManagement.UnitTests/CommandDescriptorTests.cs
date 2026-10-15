using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Operations;

namespace RentalManagement.UnitTests;

public sealed class CommandDescriptorTests
{
    private static readonly Guid Account = Guid.Parse("019a0000-0000-7000-8000-000000000001");
    private static readonly Guid RouteId = Guid.Parse("019a0000-0000-7000-8000-000000000002");
    private static readonly Guid PropertyId = Guid.Parse("019a0000-0000-7000-8000-000000000003");
    private static readonly Guid UnitId = Guid.Parse("019a0000-0000-7000-8000-000000000004");
    private static readonly Guid CreateId = Guid.Parse("019a0000-0000-7000-8000-000000000005");

    [Fact]
    public async Task EveryEndpointRetainsItsOriginalCommandIdentityScopesAndFingerprint()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(PropertiesController).Assembly);
        await using var app = builder.Build();
        var actions = app.Services.GetRequiredService<IActionDescriptorCollectionProvider>().ActionDescriptors.Items
            .OfType<ControllerActionDescriptor>()
            .Where(a => a.Parameters.Any(p => typeof(OperationRequest).IsAssignableFrom(p.ParameterType)))
            .ToArray();
        var expected = OriginalDescriptors();
        Assert.Equal(expected.Count, actions.Length);
        var names = new HashSet<string>(StringComparer.Ordinal);

        foreach (var action in actions)
        {
            var key = action.ControllerName + "." + action.ActionName;
            var original = expected[key];
            var metadata = Assert.Single(action.EndpointMetadata.OfType<BusinessCommandAttribute>());
            Assert.True(names.Add(metadata.CommandType), "Command identities must be unique.");
            var request = SampleRequest(action.Parameters.Single(p => typeof(OperationRequest).IsAssignableFrom(p.ParameterType)).ParameterType);
            var arguments = action.Parameters.Where(p => p.ParameterType == typeof(Guid))
                .ToDictionary(p => p.Name, p => (object?)(p.Name switch
                {
                    "id" => RouteId,
                    "propertyId" => PropertyId,
                    "unitId" => UnitId,
                    _ => throw new InvalidOperationException("Unexpected command route argument.")
                }));
            var expectedRoute = arguments.ToDictionary(p => p.Key, p => ((Guid)p.Value!).ToString("D"), StringComparer.Ordinal);
            var descriptor = CommandDescriptor.From(Context(action, arguments), request);

            Assert.Equal(key, descriptor.CommandType);
            Assert.Equal(original.Target, descriptor.TargetType);
            Assert.Equal(original.Id.ToString("D"), descriptor.TargetId);
            Assert.Equal(original.Scope, descriptor.AuthorizationScope);
            Assert.Equal(original.AcceptedScope ?? original.Scope, descriptor.AcceptedAuthorizationScope);
            Assert.Equal(expectedRoute.OrderBy(p => p.Key), descriptor.Route.OrderBy(p => p.Key));

            var body = JsonSerializer.SerializeToElement(request, request.GetType(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
            var oldFingerprint = CommandFingerprint.Compute(key, original.Target.ToString(), original.Id.ToString("D"), expectedRoute, body);
            var newFingerprint = CommandFingerprint.Compute(descriptor.CommandType, descriptor.TargetType.ToString(),
                descriptor.TargetId, descriptor.Route, body);
            Assert.Equal(oldFingerprint, newFingerprint);

            // CLR/controller/action names are not persisted protocol identities anymore.
            var renamed = new ControllerActionDescriptor
            {
                ControllerName = "RenamedController", ActionName = "RenamedAction",
                EndpointMetadata = action.EndpointMetadata
            };
            var renamedDescriptor = CommandDescriptor.From(Context(renamed, arguments), request);
            Assert.Equal(descriptor.CommandType, renamedDescriptor.CommandType);
            Assert.Equal(descriptor.AuthorizationScope, renamedDescriptor.AuthorizationScope);
            Assert.Equal(descriptor.AcceptedAuthorizationScope, renamedDescriptor.AcceptedAuthorizationScope);
        }
    }

    [Theory]
    [InlineData("Account", "Applicant")]
    [InlineData("Account", "Manager")]
    [InlineData("Property", "Owner")]
    [InlineData("Unit", "Applicant")]
    [InlineData("Unit", "Owner")]
    [InlineData("Application", "Applicant")]
    [InlineData("Application", "Owner")]
    [InlineData("Application", "Manager")]
    public void AuthorizationScopesRemainCompatibleWithExistingReceiptJson(string type, string access)
    {
        var json = $$"""{"type":"{{type}}","id":"{{Account:D}}","access":"{{access}}"}""";
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var scope = JsonSerializer.Deserialize<AuthorizationScope>(json, options)!;
        Assert.Equal(Enum.Parse<ResourceType>(type), scope.Type);
        Assert.Equal(Enum.Parse<ResourceAccess>(access), scope.Access);
        Assert.Equal(json, JsonSerializer.Serialize(scope, options));
    }

    [Fact]
    public void MissingDuplicateOrIncompleteMetadataFailsClosed()
    {
        var request = new ResidenceHistoryRequest(1, []);
        Assert.Throws<InvalidOperationException>(() => CommandDescriptor.From(Context(new ActionDescriptor()), request));
        var metadata = ProfileMetadata();
        Assert.Throws<InvalidOperationException>(() => CommandDescriptor.From(
            Context(new ActionDescriptor { EndpointMetadata = [metadata, metadata] }), request));
        Assert.Throws<InvalidOperationException>(() => new BusinessCommandAttribute("Missing.Fields").Validate());
        metadata.AcceptedScope = ResourceType.Property;
        Assert.Throws<InvalidOperationException>(() => metadata.Validate());
        metadata = ProfileMetadata();
        metadata.Access = (ResourceAccess)999;
        Assert.Throws<InvalidOperationException>(() => metadata.Validate());
    }

    [Fact]
    public void IdSourcesMustMatchTheRequestAndRouteAndCreateIdsStillRequireUuid7()
    {
        var request = new ResidenceHistoryRequest(1, []);
        var metadata = ProfileMetadata();
        metadata.TargetId = IdSource.RouteId;
        Assert.Throws<InvalidOperationException>(() => Resolve(metadata, request));
        metadata.TargetId = IdSource.RequestId;
        Assert.Throws<InvalidOperationException>(() => Resolve(metadata, request));
        metadata.TargetId = IdSource.RequestUnitId;
        Assert.Throws<InvalidOperationException>(() => Resolve(metadata, request));
        metadata.TargetId = IdSource.RequestId;
        Assert.Equal(400, Assert.Throws<ApiException>(() => Resolve(metadata,
            new CreatePropertyRequest(null) { Id = Guid.NewGuid() })).Status);
    }

    private static CommandDescriptor Resolve(BusinessCommandAttribute metadata, OperationRequest request) =>
        CommandDescriptor.From(Context(new ActionDescriptor { EndpointMetadata = [metadata] }), request);

    private static BusinessCommandAttribute ProfileMetadata() => new("Stable.Command")
    {
        Target = ResourceType.Profile, TargetId = IdSource.Account,
        Scope = ResourceType.Account, ScopeId = IdSource.Account, Access = ResourceAccess.Applicant
    };

    private static ActionExecutingContext Context(ActionDescriptor descriptor, IDictionary<string, object?>? arguments = null)
    {
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Account.ToString("D"))], "Test"))
        };
        return new(new ActionContext(http, new RouteData(), descriptor, new ModelStateDictionary()),
            [], arguments ?? new Dictionary<string, object?>(), new object());
    }

    private static OperationRequest SampleRequest(Type type) => type.Name switch
    {
        nameof(CreatePropertyRequest) => new CreatePropertyRequest(null) { Id = CreateId },
        nameof(UpdatePropertyRequest) => new UpdatePropertyRequest(1, null),
        nameof(CreateUnitRequest) => new CreateUnitRequest("A", Guid.Empty, 1, 100) { Id = CreateId },
        nameof(UpdateUnitRequest) => new UpdateUnitRequest(1, "A", Guid.Empty, 1, 100),
        nameof(ArchiveInventoryRequest) => new ArchiveInventoryRequest(1),
        nameof(ApplicantInformationRequest) => new ApplicantInformationRequest(1, null),
        nameof(ResidenceHistoryRequest) => new ResidenceHistoryRequest(1, []),
        nameof(CreateApplicationRequest) => new CreateApplicationRequest(CreateId, UnitId, null),
        nameof(ApplicationActionRequest) => new ApplicationActionRequest(1),
        nameof(SaveManagerNoteRequest) => new SaveManagerNoteRequest(null, ""),
        nameof(RejectAllApplicationsRequest) => new RejectAllApplicationsRequest("Reason"),
        _ => throw new InvalidOperationException("Missing sample command request.")
    };

    private sealed record Expected(ResourceType Target, Guid Id, AuthorizationScope Scope, AuthorizationScope? AcceptedScope = null);

    private static Dictionary<string, Expected> OriginalDescriptors()
    {
        var property = new Expected(ResourceType.Property, RouteId, new(ResourceType.Property, RouteId, ResourceAccess.Owner));
        var unit = new Expected(ResourceType.Unit, RouteId, new(ResourceType.Property, PropertyId, ResourceAccess.Owner));
        var profile = new Expected(ResourceType.Profile, Account, new(ResourceType.Account, Account, ResourceAccess.Applicant));
        var application = new Expected(ResourceType.Application, RouteId, new(ResourceType.Application, RouteId, ResourceAccess.Applicant));
        var review = new Expected(ResourceType.Application, RouteId, new(ResourceType.Application, RouteId, ResourceAccess.Owner));
        return new(StringComparer.Ordinal)
        {
            ["Properties.Create"] = new(ResourceType.Property, CreateId,
                new(ResourceType.Account, Account, ResourceAccess.Manager), new(ResourceType.Property, CreateId, ResourceAccess.Owner)),
            ["Properties.Update"] = property,
            ["Properties.Archive"] = property,
            ["Units.Create"] = new(ResourceType.Unit, CreateId,
                new(ResourceType.Property, PropertyId, ResourceAccess.Owner), new(ResourceType.Unit, CreateId, ResourceAccess.Owner)),
            ["Units.Update"] = unit,
            ["Units.Archive"] = unit,
            ["ApplicantProfile.ReplaceInformation"] = profile,
            ["ApplicantProfile.ReplaceResidences"] = profile,
            ["Applications.Create"] = new(ResourceType.Application, CreateId,
                new(ResourceType.Unit, UnitId, ResourceAccess.Applicant), new(ResourceType.Application, CreateId, ResourceAccess.Applicant)),
            ["Applications.SaveInformation"] = application,
            ["Applications.SaveResidences"] = application,
            ["Applications.Submit"] = application,
            ["Applications.Withdraw"] = application,
            ["ApplicationReviews.StartReview"] = review,
            ["ApplicationReviews.Release"] = review,
            ["ApplicationReviews.Return"] = review,
            ["ApplicationReviews.Deny"] = review,
            ["ApplicationReviews.Approve"] = review,
            ["ApplicationReviews.SaveNote"] = new(ResourceType.ManagerNote, RouteId,
                new(ResourceType.Application, RouteId, ResourceAccess.Manager)),
            ["UnitApplications.RejectAll"] = new(ResourceType.Unit, UnitId, new(ResourceType.Unit, UnitId, ResourceAccess.Owner))
        };
    }
}
