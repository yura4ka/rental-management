using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Persistence.Configurations;

namespace RentalManagement.Api.Persistence;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<IdentityUser<Guid>, IdentityRole<Guid>, Guid>(options)
{
    internal bool PreserveSeedInsertValues { get; set; }
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<UnitType> UnitTypes => Set<UnitType>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<UnitLeaseGuard> UnitLeaseGuards => Set<UnitLeaseGuard>();
    public DbSet<ApplicantProfile> ApplicantProfiles => Set<ApplicantProfile>();
    public DbSet<ProfileResidence> ProfileResidences => Set<ProfileResidence>();
    public DbSet<RentalApplication> RentalApplications => Set<RentalApplication>();
    public DbSet<ApplicationResidence> ApplicationResidences => Set<ApplicationResidence>();
    public DbSet<ApplicationStatusHistory> ApplicationStatusHistory => Set<ApplicationStatusHistory>();
    public DbSet<ManagerNote> ManagerNotes => Set<ManagerNote>();
    public DbSet<Lease> Leases => Set<Lease>();
    public DbSet<DatabaseMetadata> DatabaseMetadata => Set<DatabaseMetadata>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        DomainModelConventions.Apply(builder);
        foreach (var foreignKey in builder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            foreignKey.DeleteBehavior = DeleteBehavior.NoAction;
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareChanges();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareChanges();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void PrepareChanges()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified))
        {
            // Only the transactional seeder opts in; normal API writes retain automatic timestamps/versions.
            if (PreserveSeedInsertValues && entry.State == EntityState.Added) continue;
            if (entry.Metadata.FindProperty("Version") is not null)
            {
                var version = entry.Property("Version");
                version.CurrentValue = entry.State == EntityState.Added ? 1L : checked((long)version.OriginalValue! + 1);
            }
            if (entry.Metadata.FindProperty("CreatedAt") is not null)
            {
                if (entry.State == EntityState.Added) entry.Property("CreatedAt").CurrentValue = now;
                else entry.Property("CreatedAt").IsModified = false;
            }
            if (entry.Metadata.FindProperty("UpdatedAt") is not null)
                entry.Property("UpdatedAt").CurrentValue = now;
        }
    }
}
