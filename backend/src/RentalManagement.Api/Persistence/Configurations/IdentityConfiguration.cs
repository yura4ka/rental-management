using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RentalManagement.Api.Persistence.Configurations;

public sealed class IdentityUserConfiguration : IEntityTypeConfiguration<IdentityUser<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUser<Guid>> builder)
    {
        builder.Property(u => u.Id).ValueGeneratedNever();
        builder.Property(u => u.NormalizedEmail).UseCollation(DomainModelConventions.BinaryCollation);
        builder.Property(u => u.NormalizedUserName).UseCollation(DomainModelConventions.BinaryCollation);
        builder.HasIndex(u => u.NormalizedEmail).HasDatabaseName("EmailIndex")
            .IsUnique().HasFilter("[NormalizedEmail] IS NOT NULL");
    }
}

public sealed class IdentityUserRoleConfiguration : IEntityTypeConfiguration<IdentityUserRole<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserRole<Guid>> builder) =>
        builder.HasIndex(r => r.UserId).HasDatabaseName("UX_AspNetUserRoles_UserId").IsUnique();
}

public sealed class IdentityRoleConfiguration : IEntityTypeConfiguration<IdentityRole<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityRole<Guid>> builder)
    {
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.HasData(
            new IdentityRole<Guid>("Applicant")
            {
                Id = Guid.Parse("019a0000-0000-7000-8000-000000000001"),
                NormalizedName = "APPLICANT", ConcurrencyStamp = "applicant-role-v1"
            },
            new IdentityRole<Guid>("PropertyManager")
            {
                Id = Guid.Parse("019a0000-0000-7000-8000-000000000002"),
                NormalizedName = "PROPERTYMANAGER", ConcurrencyStamp = "manager-role-v1"
            });
    }
}

public sealed class IdentityLoginConfiguration : IEntityTypeConfiguration<IdentityUserLogin<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserLogin<Guid>> builder)
    {
        builder.Property(l => l.LoginProvider).HasMaxLength(128);
        builder.Property(l => l.ProviderKey).HasMaxLength(128);
    }
}

public sealed class IdentityTokenConfiguration : IEntityTypeConfiguration<IdentityUserToken<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserToken<Guid>> builder)
    {
        builder.Property(t => t.LoginProvider).HasMaxLength(128);
        builder.Property(t => t.Name).HasMaxLength(128);
    }
}
