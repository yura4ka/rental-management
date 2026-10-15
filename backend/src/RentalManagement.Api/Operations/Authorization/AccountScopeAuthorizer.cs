using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.Api.Operations.Authorization;

public sealed class AccountScopeAuthorizer(ApplicationDbContext db) : IOperationScopeAuthorizer
{
    public ResourceType ResourceType => ResourceType.Account;
    public bool Supports(ResourceAccess access) => access is ResourceAccess.Applicant or ResourceAccess.Manager;

    public async Task CheckAsync(Guid accountId, AuthorizationScope scope, CancellationToken ct)
    {
        if (scope.Type != ResourceType || !Supports(scope.Access))
            throw new InvalidOperationException("Unsupported account authorization scope.");

        if (scope.Id != accountId || !await db.Users.AnyAsync(u => u.Id == accountId, ct))
            throw new ApiException(404, "ResourceNotFound", "Resource not found.");
    }
}
