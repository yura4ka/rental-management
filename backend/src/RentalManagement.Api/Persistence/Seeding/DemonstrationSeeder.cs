using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Seeding;

public sealed class DemonstrationSeeder(ApplicationDbContext db, UserManager<IdentityUser<Guid>> users,
    RoleManager<IdentityRole<Guid>> roles, IConfiguration configuration)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var metadata = await db.DatabaseMetadata.SingleOrDefaultAsync(cancellationToken);
        if (metadata?.SeedVersion == DemoSeedData.CurrentVersion) return;
        if (metadata?.SeedVersion > DemoSeedData.CurrentVersion)
            throw new InvalidOperationException("The database seed version is newer than this application; refusing a downgrade.");

        // Each version is a new graph. Never reconstruct or modify a previous version's graph.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.PreserveSeedInsertValues = true;
        try
        {
            foreach (var name in new[] { AccountRoles.PropertyManager, AccountRoles.Applicant })
                if (!await roles.RoleExistsAsync(name))
                    RequireSuccess(await roles.CreateAsync(new IdentityRole<Guid>(name)
                    {
                        Id = DemoSeedData.Id($"role:{name}", 0)
                    }));

            var typeIds = new Dictionary<string, Guid>();
            foreach (var code in DemoSeedData.TypeCodes)
            {
                var type = await db.UnitTypes.SingleOrDefaultAsync(t => t.Code == code, cancellationToken);
                if (type is null)
                {
                    type = new UnitType { Id = DemoSeedData.Id($"type:{code}", 0), Code = code, Name = code, IsActive = code != "Penthouse" };
                    db.UnitTypes.Add(type);
                }
                typeIds.Add(code, type.Id);
            }

            var data = DemoSeedData.Create(typeIds);
            // A pre-existing current-version account is a collision, not permission to change or adopt user data.
            var ids = data.Accounts.Select(a => a.Id).ToArray();
            var emails = data.Accounts.Select(a => a.Email.ToUpperInvariant()).ToArray();
            if (await db.Users.AnyAsync(u => ids.Contains(u.Id) || emails.Contains(u.NormalizedEmail!), cancellationToken))
                throw new InvalidOperationException("The new seed dataset conflicts with existing accounts.");
            var password = configuration["Seeding:DemoPassword"];
            if (password is not { Length: >= 12 and <= 128 } || string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Set Seeding:DemoPassword to 12–128 nonblank characters through secrets or environment configuration.");
            foreach (var account in data.Accounts)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var user = new IdentityUser<Guid> { Id = account.Id, UserName = account.Email, Email = account.Email };
                RequireSuccess(await users.CreateAsync(user, password));
                RequireSuccess(await users.AddToRoleAsync(user, account.Role));
            }
            db.Properties.AddRange(data.Properties);
            db.Units.AddRange(data.Units);
            db.UnitLeaseGuards.AddRange(data.Guards);
            db.ApplicantProfiles.AddRange(data.Profiles);
            db.ProfileResidences.AddRange(data.ProfileResidences);
            db.RentalApplications.AddRange(data.Applications);
            db.ApplicationResidences.AddRange(data.ApplicationResidences);
            db.ApplicationStatusHistory.AddRange(data.History);
            db.Leases.AddRange(data.Leases);
            if (metadata is null)
            {
                metadata = new DatabaseMetadata { EnvironmentGeneration = Guid.NewGuid(), InitializedAt = DateTimeOffset.UtcNow };
                db.DatabaseMetadata.Add(metadata);
            }
            metadata.SeedVersion = DemoSeedData.CurrentVersion;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            db.PreserveSeedInsertValues = false;
        }
    }

    private static void RequireSuccess(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Identity seed creation failed.");
    }
}
