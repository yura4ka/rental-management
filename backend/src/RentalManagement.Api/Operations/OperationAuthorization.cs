using System.Security.Claims;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Operations.Authorization;

namespace RentalManagement.Api.Operations;

public sealed class OperationAuthorization
{
    private readonly IReadOnlyDictionary<ResourceType, IOperationScopeAuthorizer> handlers;

    public OperationAuthorization(IEnumerable<IOperationScopeAuthorizer> handlers)
    {
        this.handlers = handlers.ToDictionary(h => h.ResourceType);
    }

    public async Task CheckAsync(ClaimsPrincipal principal, AuthorizationScope scope, CancellationToken ct)
    {
        var account = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var manager = principal.IsInRole(AccountRoles.PropertyManager);
        var forbidden = scope.Access switch
        {
            ResourceAccess.Applicant => !principal.IsInRole(AccountRoles.Applicant),
            ResourceAccess.Manager or ResourceAccess.Owner => !manager,
            _ => throw new InvalidOperationException("Invalid operation resource access.")
        };
        if (forbidden)
            throw new ApiException(403, "Forbidden", "This action requires the appropriate role.");

        if (!handlers.TryGetValue(scope.Type, out var handler))
            throw new InvalidOperationException("Invalid operation authorization scope.");
        if (!handler.Supports(scope.Access))
            throw new InvalidOperationException("Unsupported operation resource access.");

        await handler.CheckAsync(account, scope, ct);
    }
}
