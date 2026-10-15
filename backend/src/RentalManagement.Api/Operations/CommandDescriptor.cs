using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Filters;
using RentalManagement.Api.Contracts.Operations;

namespace RentalManagement.Api.Operations;

public sealed record AuthorizationScope(ResourceType Type, Guid Id, ResourceAccess Access);
public sealed record CommandDescriptor(string CommandType, ResourceType TargetType, string TargetId,
    AuthorizationScope AuthorizationScope, AuthorizationScope AcceptedAuthorizationScope,
    IReadOnlyDictionary<string, string> Route)
{
    public static CommandDescriptor From(ActionExecutingContext context, OperationRequest request)
    {
        var metadata = context.ActionDescriptor.EndpointMetadata.OfType<BusinessCommandAttribute>().SingleOrDefault()
            ?? throw new InvalidOperationException("Business commands require explicit endpoint metadata.");
        metadata.Validate();
        var account = Guid.Parse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        Guid Argument(string name) => context.ActionArguments.TryGetValue(name, out var value) && value is Guid id
            ? id : throw new InvalidOperationException("Missing command route ID.");
        Guid Resolve(IdSource source) => source switch
        {
            IdSource.Account => account,
            IdSource.RouteId => Argument("id"),
            IdSource.RoutePropertyId => Argument("propertyId"),
            IdSource.RouteUnitId => Argument("unitId"),
            IdSource.RequestId when request is ICreateResourceRequest create => CreateId(create.Id),
            IdSource.RequestUnitId when request is IUnitTargetRequest unit => unit.UnitId,
            _ => throw new InvalidOperationException("Command ID source is unsupported or incompatible with the request.")
        };

        var targetId = Resolve(metadata.TargetId);
        var scope = new AuthorizationScope(metadata.Scope, Resolve(metadata.ScopeId), metadata.Access);
        var acceptedScope = metadata.AcceptedScope == ResourceType.Unspecified ? scope :
            new AuthorizationScope(metadata.AcceptedScope, Resolve(metadata.AcceptedScopeId), metadata.AcceptedAccess);

        var route = context.ActionArguments.Where(p => p.Value is Guid)
            .ToDictionary(p => p.Key, p => ((Guid)p.Value!).ToString("D"), StringComparer.Ordinal);
        return new(metadata.CommandType, metadata.Target, targetId.ToString("D"), scope, acceptedScope, route);
    }

    private static Guid CreateId(Guid id)
    {
        CommandRunner.RequireUuid7(id, "id");
        return id;
    }
}
