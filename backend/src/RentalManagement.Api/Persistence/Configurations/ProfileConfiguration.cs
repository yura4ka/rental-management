using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Configurations;

public sealed class ApplicantProfileConfiguration : IEntityTypeConfiguration<ApplicantProfile>
{
    public void Configure(EntityTypeBuilder<ApplicantProfile> b)
    {
        b.ToTable("ApplicantProfiles");
        b.HasKey(p => p.ApplicantId);
        b.Property(p => p.ApplicantId).ValueGeneratedNever();
        b.Property(p => p.Name).HasMaxLength(100);
        b.Property(p => p.ContactEmail).HasMaxLength(254);
        DomainModelConventions.Phone(b, "Phone");
        DomainModelConventions.Address(b, p => p.CurrentAddress, "CurrentAddress", false);
        b.HasOne<IdentityUser<Guid>>().WithOne().HasForeignKey<ApplicantProfile>(p => p.ApplicantId);
    }
}

public sealed class ProfileResidenceConfiguration : IEntityTypeConfiguration<ProfileResidence>
{
    public void Configure(EntityTypeBuilder<ProfileResidence> b)
    {
        b.ToTable("ProfileResidences", t =>
        {
            t.HasCheckConstraint("CK_ProfileResidences_Position", "[Position] >= 0");
            t.HasCheckConstraint("CK_ProfileResidences_Dates", "[MoveInDate] < [MoveOutDate]");
        });
        b.HasKey(r => new { r.ApplicantId, r.Position });
        b.Property(r => r.LandlordName).HasMaxLength(100);
        DomainModelConventions.Phone(b, "LandlordPhone");
        DomainModelConventions.Address(b, r => r.Address, "Address", true);
        b.HasOne<ApplicantProfile>().WithMany().HasForeignKey(r => r.ApplicantId);
        b.HasIndex(r => new { r.ApplicantId, r.MoveInDate, r.MoveOutDate, r.Position }).HasDatabaseName("IX_ProfileResidences_Chronological");
    }
}
