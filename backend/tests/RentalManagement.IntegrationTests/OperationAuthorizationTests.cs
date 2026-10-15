using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Operations;
using RentalManagement.Api.Persistence;

namespace RentalManagement.IntegrationTests;

public sealed class OperationAuthorizationTests
{
    [SqlServerFact]
    public async Task ResourceHandlersPreserveOwnershipAndNotFoundBehaviorAndRecheckCurrentOwnership()
    {
        await using var fixture = new StartupSeedingTests.DatabaseFixture();
        await fixture.InitializeAsync();
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authorization = scope.ServiceProvider.GetRequiredService<OperationAuthorization>();
        var resource = await (from a in db.RentalApplications
                              join u in db.Units on a.UnitId equals u.Id
                              join p in db.Properties on u.PropertyId equals p.Id
                              select new { ApplicationId = a.Id, a.ApplicantId, UnitId = u.Id, PropertyId = p.Id, p.OwnerManagerId }).FirstAsync();
        var otherManagerId = await (from ur in db.UserRoles
                                    join r in db.Roles on ur.RoleId equals r.Id
                                    where r.Name == AccountRoles.PropertyManager && ur.UserId != resource.OwnerManagerId
                                    select ur.UserId).FirstAsync();
        var otherApplicantId = await db.ApplicantProfiles.Where(p => p.ApplicantId != resource.ApplicantId)
            .Select(p => p.ApplicantId).FirstAsync();
        var owner = Principal(resource.OwnerManagerId, AccountRoles.PropertyManager);
        var manager = Principal(otherManagerId, AccountRoles.PropertyManager);
        var applicant = Principal(resource.ApplicantId, AccountRoles.Applicant);
        var otherApplicant = Principal(otherApplicantId, AccountRoles.Applicant);

        await Check(owner, ResourceType.Account, resource.OwnerManagerId, ResourceAccess.Manager);
        await Check(applicant, ResourceType.Account, resource.ApplicantId, ResourceAccess.Applicant);
        await Check(owner, ResourceType.Property, resource.PropertyId, ResourceAccess.Owner);
        await Check(owner, ResourceType.Unit, resource.UnitId, ResourceAccess.Owner);
        await Check(applicant, ResourceType.Unit, resource.UnitId, ResourceAccess.Applicant);
        await Check(owner, ResourceType.Application, resource.ApplicationId, ResourceAccess.Owner);
        await Check(applicant, ResourceType.Application, resource.ApplicationId, ResourceAccess.Applicant);
        await Check(manager, ResourceType.Application, resource.ApplicationId, ResourceAccess.Manager);

        await Rejected(404, owner, ResourceType.Account, resource.ApplicantId, ResourceAccess.Manager);
        await Rejected(404, manager, ResourceType.Property, resource.PropertyId, ResourceAccess.Owner);
        await Rejected(403, manager, ResourceType.Unit, resource.UnitId, ResourceAccess.Owner);
        await Rejected(403, manager, ResourceType.Application, resource.ApplicationId, ResourceAccess.Owner);
        await Rejected(404, otherApplicant, ResourceType.Application, resource.ApplicationId, ResourceAccess.Applicant);
        await Rejected(403, applicant, ResourceType.Application, resource.ApplicationId, ResourceAccess.Owner);

        var missingAccountId = Guid.NewGuid();
        await Rejected(404, Principal(missingAccountId, AccountRoles.Applicant), ResourceType.Account,
            missingAccountId, ResourceAccess.Applicant);
        await Rejected(404, owner, ResourceType.Property, Guid.NewGuid(), ResourceAccess.Owner);
        await Rejected(404, owner, ResourceType.Unit, Guid.NewGuid(), ResourceAccess.Owner);
        await Rejected(404, applicant, ResourceType.Unit, Guid.NewGuid(), ResourceAccess.Applicant);
        await Rejected(404, owner, ResourceType.Application, Guid.NewGuid(), ResourceAccess.Owner);
        await Rejected(404, manager, ResourceType.Application, Guid.NewGuid(), ResourceAccess.Manager);
        await Rejected(404, applicant, ResourceType.Application, Guid.NewGuid(), ResourceAccess.Applicant);

        await db.Properties.Where(p => p.Id == resource.PropertyId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.OwnerManagerId, otherManagerId));
        await Rejected(404, owner, ResourceType.Property, resource.PropertyId, ResourceAccess.Owner);
        await Rejected(403, owner, ResourceType.Unit, resource.UnitId, ResourceAccess.Owner);
        await Rejected(403, owner, ResourceType.Application, resource.ApplicationId, ResourceAccess.Owner);
        await Check(manager, ResourceType.Property, resource.PropertyId, ResourceAccess.Owner);
        await Check(manager, ResourceType.Unit, resource.UnitId, ResourceAccess.Owner);
        await Check(manager, ResourceType.Application, resource.ApplicationId, ResourceAccess.Owner);

        Task Check(ClaimsPrincipal principal, ResourceType type, Guid id, ResourceAccess access) =>
            authorization.CheckAsync(principal, new(type, id, access), default);

        async Task Rejected(int status, ClaimsPrincipal principal, ResourceType type, Guid id, ResourceAccess access)
        {
            var error = await Assert.ThrowsAsync<ApiException>(() => Check(principal, type, id, access));
            Assert.Equal(status, error.Status);
            Assert.Equal(status == 403 ? "Forbidden" : "ResourceNotFound", error.Code);
        }
    }

    private static ClaimsPrincipal Principal(Guid id, string role) => new(new ClaimsIdentity(
        [new Claim(ClaimTypes.NameIdentifier, id.ToString("D")), new Claim(ClaimTypes.Role, role)], "Test"));
}
