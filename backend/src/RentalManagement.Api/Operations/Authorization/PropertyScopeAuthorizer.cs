using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.Api.Operations.Authorization;

public sealed class PropertyScopeAuthorizer(ApplicationDbContext db) : IOperationScopeAuthorizer
{
    public ResourceType ResourceType => ResourceType.Property;
    public bool Supports(ResourceAccess access) => access == ResourceAccess.Owner;

    public async Task CheckAsync(Guid accountId, AuthorizationScope scope, CancellationToken ct)
    {
        if (scope.Type != ResourceType || !Supports(scope.Access))
            throw new InvalidOperationException("Unsupported property authorization scope.");

        if (!await db.Properties.AnyAsync(p => p.Id == scope.Id && p.OwnerManagerId == accountId, ct))
            throw new ApiException(404, "ResourceNotFound", "Resource not found.");
    }
}
