using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.Api.Operations;

public sealed class OperationAuthorization(ApplicationDbContext db)
{
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
        bool allowed;
        switch (scope.Type)
        {
            case ResourceType.Account:
                allowed = scope.Id == account && await db.Users.AnyAsync(u => u.Id == account, ct);
                break;
            case ResourceType.Property:
                allowed = await db.Properties.AnyAsync(p => p.Id == scope.Id && p.OwnerManagerId == account, ct);
                break;
            case ResourceType.Unit:
                allowed = await (from u in db.Units
                                 join p in db.Properties on u.PropertyId equals p.Id
                                 where u.Id == scope.Id && (scope.Access == ResourceAccess.Applicant || p.OwnerManagerId == account)
                                 select u.Id).AnyAsync(ct);
                if (!allowed && scope.Access == ResourceAccess.Owner && await db.Units.AnyAsync(u => u.Id == scope.Id, ct))
                    throw new ApiException(403, "Forbidden", "Property ownership is required.");
                break;
            case ResourceType.Application:
                allowed = await (from a in db.RentalApplications
                                 join u in db.Units on a.UnitId equals u.Id
                                 join p in db.Properties on u.PropertyId equals p.Id
                                 where a.Id == scope.Id && (scope.Access == ResourceAccess.Applicant ? a.ApplicantId == account :
                                     scope.Access == ResourceAccess.Manager || p.OwnerManagerId == account)
                                 select a.Id).AnyAsync(ct);
                if (!allowed && scope.Access == ResourceAccess.Owner && await db.RentalApplications.AnyAsync(a => a.Id == scope.Id, ct))
                    throw new ApiException(403, "Forbidden", "Property ownership is required.");
                break;
            default: throw new InvalidOperationException("Invalid operation authorization scope.");
        }
        if (!allowed) throw new ApiException(404, "ResourceNotFound", "Resource not found.");
    }
}
