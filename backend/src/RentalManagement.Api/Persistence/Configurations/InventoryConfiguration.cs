using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Configurations;

public sealed class PropertyConfiguration : IEntityTypeConfiguration<Property>
{
    public void Configure(EntityTypeBuilder<Property> b)
    {
        b.ToTable("Properties");
        b.HasKey(p => p.Id);
        b.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(p => p.OwnerManagerId);
        b.HasIndex(p => new { p.OwnerManagerId, p.ArchivedAt });
        DomainModelConventions.Address(b, p => p.Address, "", true);
    }
}

public sealed class UnitTypeConfiguration : IEntityTypeConfiguration<UnitType>
{
    public void Configure(EntityTypeBuilder<UnitType> b)
    {
        b.ToTable("UnitTypes");
        b.HasKey(t => t.Id);
        b.Property(t => t.Code).HasMaxLength(30).IsUnicode(false).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(t => t.Name).HasMaxLength(100);
        b.HasIndex(t => t.Code).IsUnique().HasDatabaseName("UX_UnitTypes_Code");
    }
}

public sealed class UnitConfiguration : IEntityTypeConfiguration<Unit>
{
    public void Configure(EntityTypeBuilder<Unit> b)
    {
        b.ToTable("Units", t =>
        {
            t.HasCheckConstraint("CK_Units_Number", "DATALENGTH([Number]) BETWEEN 2 AND 40 AND [Number] NOT LIKE N'%[^A-Z0-9_-]%' COLLATE Latin1_General_100_BIN2");
            t.HasCheckConstraint("CK_Units_Bedrooms", "[Bedrooms] >= 0");
            t.HasCheckConstraint("CK_Units_MonthlyRent", "[MonthlyRent] > 0");
        });
        b.HasKey(u => u.Id);
        b.Property(u => u.Number).HasMaxLength(20).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(u => u.MonthlyRent).HasPrecision(12, 2);
        b.HasOne<Property>().WithMany().HasForeignKey(u => u.PropertyId);
        b.HasOne<UnitType>().WithMany().HasForeignKey(u => u.UnitTypeId);
        b.HasIndex(u => new { u.PropertyId, u.Number }).IsUnique().HasDatabaseName("UX_Units_Property_Number");
        b.HasIndex(u => new { u.PropertyId, u.ArchivedAt });
        b.HasIndex(u => u.UnitTypeId);
    }
}

public sealed class UnitLeaseGuardConfiguration : IEntityTypeConfiguration<UnitLeaseGuard>
{
    public void Configure(EntityTypeBuilder<UnitLeaseGuard> b)
    {
        b.ToTable("UnitLeaseGuards");
        b.HasKey(g => g.UnitId);
        b.Property(g => g.UnitId).ValueGeneratedNever();
        b.HasOne<Unit>().WithOne().HasForeignKey<UnitLeaseGuard>(g => g.UnitId);
    }
}
