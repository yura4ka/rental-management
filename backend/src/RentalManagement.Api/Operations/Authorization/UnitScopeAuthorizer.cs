using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.Api.Operations.Authorization;

public sealed class UnitScopeAuthorizer(ApplicationDbContext db) : IOperationScopeAuthorizer
{
    public ResourceType ResourceType => ResourceType.Unit;
    public bool Supports(ResourceAccess access) => access is ResourceAccess.Applicant or ResourceAccess.Owner;

    public async Task CheckAsync(Guid accountId, AuthorizationScope scope, CancellationToken ct)
    {
        if (scope.Type != ResourceType || !Supports(scope.Access))
            throw new InvalidOperationException("Unsupported unit authorization scope.");

        var allowed = await (from u in db.Units
                             join p in db.Properties on u.PropertyId equals p.Id
                             where u.Id == scope.Id && (scope.Access == ResourceAccess.Applicant || p.OwnerManagerId == accountId)
                             select u.Id).AnyAsync(ct);
        if (allowed) return;

        if (scope.Access == ResourceAccess.Owner && await db.Units.AnyAsync(u => u.Id == scope.Id, ct))
            throw new ApiException(403, "Forbidden", "Property ownership is required.");
        throw new ApiException(404, "ResourceNotFound", "Resource not found.");
    }
}
