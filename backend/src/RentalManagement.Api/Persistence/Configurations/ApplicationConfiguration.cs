using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Configurations;

public sealed class RentalApplicationConfiguration : IEntityTypeConfiguration<RentalApplication>
{
    public void Configure(EntityTypeBuilder<RentalApplication> b)
    {
        b.ToTable("RentalApplications", t =>
        {
            t.HasCheckConstraint("CK_RentalApplications_Status", "[Status] IN ('Draft', 'Submitted', 'InReview', 'Returned', 'Approved', 'Denied', 'Withdrawn')");
            t.HasCheckConstraint("CK_RentalApplications_SavedHistory", "[Status] IN ('Draft', 'Withdrawn', 'Denied') OR [ResidenceHistorySavedAt] IS NOT NULL");
        });
        b.HasKey(a => a.Id);
        b.Property(a => a.Status).HasConversion<string>().HasMaxLength(20).IsUnicode(false).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(a => a.ApplicantName).HasMaxLength(100);
        b.Property(a => a.ContactEmail).HasMaxLength(254);
        DomainModelConventions.Phone(b, "ApplicantPhone");
        DomainModelConventions.Address(b, a => a.CurrentAddress, "CurrentAddress", true);
        b.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(a => a.ApplicantId);
        b.HasOne<Unit>().WithMany().HasForeignKey(a => a.UnitId);
        b.HasIndex(a => new { a.ApplicantId, a.UnitId }).IsUnique().HasDatabaseName("UX_Applications_OpenApplicantUnit")
            .HasFilter("[Status] IN ('Draft', 'Submitted', 'InReview', 'Returned')");
        b.HasIndex(a => new { a.ApplicantId, a.CreatedAt }).IsDescending(false, true).HasDatabaseName("IX_Applications_Applicant_Created");
        b.HasIndex(a => new { a.ApplicantId, a.StatusChangedAt }).IsDescending(false, true).HasDatabaseName("IX_Applications_Applicant_StatusChanged");
        b.HasIndex(a => a.CreatedAt).IsDescending().HasDatabaseName("IX_Applications_Created");
        b.HasIndex(a => a.StatusChangedAt).IsDescending().HasDatabaseName("IX_Applications_StatusChanged");
        b.HasIndex(a => new { a.Status, a.CreatedAt }).IsDescending(false, true).HasDatabaseName("IX_Applications_Status_Created");
        b.HasIndex(a => new { a.Status, a.StatusChangedAt }).IsDescending(false, true).HasDatabaseName("IX_Applications_Status_StatusChanged");
        b.HasIndex(a => a.UnitId).HasDatabaseName("IX_Applications_UnitId");
    }
}

public sealed class ApplicationResidenceConfiguration : IEntityTypeConfiguration<ApplicationResidence>
{
    public void Configure(EntityTypeBuilder<ApplicationResidence> b)
    {
        b.ToTable("ApplicationResidences", t =>
        {
            t.HasCheckConstraint("CK_ApplicationResidences_Position", "[Position] >= 0");
            t.HasCheckConstraint("CK_ApplicationResidences_Dates", "[MoveInDate] < [MoveOutDate]");
        });
        b.HasKey(r => new { r.ApplicationId, r.Position });
        b.Property(r => r.LandlordName).HasMaxLength(100);
        DomainModelConventions.Phone(b, "LandlordPhone");
        DomainModelConventions.Address(b, r => r.Address, "Address", true);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(r => r.ApplicationId);
        b.HasIndex(r => new { r.ApplicationId, r.MoveInDate, r.MoveOutDate, r.Position }).HasDatabaseName("IX_ApplicationResidences_Chronological");
    }
}

public sealed class ApplicationStatusHistoryConfiguration : IEntityTypeConfiguration<ApplicationStatusHistory>
{
    public void Configure(EntityTypeBuilder<ApplicationStatusHistory> b)
    {
        b.ToTable("ApplicationStatusHistory", t =>
        {
            t.HasCheckConstraint("CK_History_Sequence", "[Sequence] >= 1");
            t.HasCheckConstraint("CK_History_Comment", "[Action] NOT IN ('Return', 'Deny') OR [Comment] IS NOT NULL");
            // Explicit IS NOT NULL prevents SQL UNKNOWN from accepting invalid non-Create transitions.
            t.HasCheckConstraint("CK_History_Transition", """
                ([Action] = 'Create' AND [FromStatus] IS NULL AND [ToStatus] = 'Draft') OR
                ([FromStatus] IS NOT NULL AND (
                  ([Action] = 'Submit' AND [FromStatus] IN ('Draft', 'Returned') AND [ToStatus] = 'Submitted') OR
                  ([Action] = 'StartReview' AND [FromStatus] = 'Submitted' AND [ToStatus] = 'InReview') OR
                  ([Action] = 'Release' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Submitted') OR
                  ([Action] = 'Return' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Returned') OR
                  ([Action] = 'Deny' AND [FromStatus] IN ('Draft', 'Submitted', 'InReview', 'Returned') AND [ToStatus] = 'Denied') OR
                  ([Action] = 'Approve' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Approved') OR
                  ([Action] = 'Withdraw' AND [FromStatus] IN ('Draft', 'Returned', 'Submitted', 'InReview') AND [ToStatus] = 'Withdrawn'))
                """);
        });
        b.HasKey(h => h.Id);
        b.Property(h => h.Action).HasConversion<string>().HasMaxLength(20).IsUnicode(false).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(h => h.FromStatus).HasConversion<string>().HasMaxLength(20).IsUnicode(false).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(h => h.ToStatus).HasConversion<string>().HasMaxLength(20).IsUnicode(false).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(h => h.Comment).HasMaxLength(2000);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(h => h.ApplicationId);
        b.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(h => h.ActorUserId);
        b.HasIndex(h => new { h.ApplicationId, h.Sequence }).IsUnique().HasDatabaseName("UX_History_Application_Sequence");
        b.HasIndex(h => h.ActorUserId).HasDatabaseName("IX_History_ActorUserId");
    }
}

public sealed class ManagerNoteConfiguration : IEntityTypeConfiguration<ManagerNote>
{
    public void Configure(EntityTypeBuilder<ManagerNote> b)
    {
        b.ToTable("ManagerNotes");
        b.HasKey(n => new { n.ApplicationId, n.AuthorManagerId });
        b.Property(n => n.Body).HasMaxLength(2000);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(n => n.ApplicationId);
        b.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(n => n.AuthorManagerId);
    }
}

public sealed class LeaseConfiguration : IEntityTypeConfiguration<Lease>
{
    public void Configure(EntityTypeBuilder<Lease> b)
    {
        b.ToTable("Leases", t =>
        {
            t.HasCheckConstraint("CK_Leases_Dates", "[StartDate] < [EndDateExclusive]");
            t.HasCheckConstraint("CK_Leases_Duration", "[EndDateExclusive] = DATEADD(month, 12, [StartDate])");
            t.HasCheckConstraint("CK_Leases_StartInstant", "[StartDate] = CONVERT(date, [ApprovedAt])");
        });
        b.HasKey(l => l.Id);
        b.HasOne<RentalApplication>().WithOne().HasForeignKey<Lease>(l => l.ApplicationId);
        b.HasIndex(l => l.ApplicationId).IsUnique().HasDatabaseName("UX_Leases_ApplicationId");
    }
}

public sealed class DatabaseMetadataConfiguration : IEntityTypeConfiguration<DatabaseMetadata>
{
    public void Configure(EntityTypeBuilder<DatabaseMetadata> b)
    {
        b.ToTable("DatabaseMetadata", t =>
        {
            t.HasCheckConstraint("CK_DatabaseMetadata_Singleton", "[SingletonId] = 1");
            t.HasCheckConstraint("CK_DatabaseMetadata_SeedVersion", "[SeedVersion] >= 0");
        });
        b.HasKey(m => m.SingletonId);
        b.Property(m => m.SingletonId).ValueGeneratedNever();
    }
}
