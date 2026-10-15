using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.Api.Operations.Authorization;

public sealed class ApplicationScopeAuthorizer(ApplicationDbContext db) : IOperationScopeAuthorizer
{
    public ResourceType ResourceType => ResourceType.Application;
    public bool Supports(ResourceAccess access) => access is ResourceAccess.Applicant or ResourceAccess.Manager or ResourceAccess.Owner;

    public async Task CheckAsync(Guid accountId, AuthorizationScope scope, CancellationToken ct)
    {
        if (scope.Type != ResourceType || !Supports(scope.Access))
            throw new InvalidOperationException("Unsupported application authorization scope.");

        var allowed = await (from a in db.RentalApplications
                             join u in db.Units on a.UnitId equals u.Id
                             join p in db.Properties on u.PropertyId equals p.Id
                             where a.Id == scope.Id && (scope.Access == ResourceAccess.Applicant ? a.ApplicantId == accountId :
                                 scope.Access == ResourceAccess.Manager || p.OwnerManagerId == accountId)
                             select a.Id).AnyAsync(ct);
        if (allowed) return;

        if (scope.Access == ResourceAccess.Owner && await db.RentalApplications.AnyAsync(a => a.Id == scope.Id, ct))
            throw new ApiException(403, "Forbidden", "Property ownership is required.");
        throw new ApiException(404, "ResourceNotFound", "Resource not found.");
    }
}
