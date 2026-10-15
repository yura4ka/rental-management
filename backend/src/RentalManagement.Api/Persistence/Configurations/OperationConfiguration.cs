using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Configurations;

public sealed class OperationReceiptConfiguration : IEntityTypeConfiguration<OperationReceipt>
{
    public void Configure(EntityTypeBuilder<OperationReceipt> b)
    {
        b.ToTable("OperationReceipts", t =>
        {
            t.HasCheckConstraint("CK_Receipts_FingerprintVersion", "[FingerprintVersion] >= 1");
            t.HasCheckConstraint("CK_Receipts_ResponseSchemaVersion", "[ResponseSchemaVersion] IS NULL OR [ResponseSchemaVersion] >= 1");
            t.HasCheckConstraint("CK_Receipts_Json", "[ResponseJson] IS NULL OR ISJSON([ResponseJson]) = 1");
            t.HasCheckConstraint("CK_Receipts_Shape", """
                ([Outcome] IS NULL AND [HttpStatus] IS NULL AND [Code] IS NULL AND
                 [ResponseSchemaVersion] IS NULL AND [ResponseJson] IS NULL AND [FinalizedAt] IS NULL) OR
                ([Outcome] IS NOT NULL AND [HttpStatus] IS NOT NULL AND [ResponseSchemaVersion] IS NOT NULL AND
                 [ResponseJson] IS NOT NULL AND [FinalizedAt] IS NOT NULL AND
                 (([Outcome] = 'Accepted' AND [HttpStatus] BETWEEN 200 AND 299) OR
                  ([Outcome] = 'Rejected' AND [HttpStatus] IN (409, 422) AND [Code] IS NOT NULL)))
                """);
        });
        b.HasKey(r => new { r.AccountId, r.OperationId });
        b.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(r => r.AccountId);
        // The composite PK already supports account-scoped lookup; avoid a redundant FK index.
        b.Property(r => r.CommandType).HasMaxLength(100).IsUnicode(false);
        b.Property(r => r.TargetType).HasMaxLength(50).IsUnicode(false);
        b.Property(r => r.TargetId).HasMaxLength(450);
        b.Property(r => r.RequestFingerprint).HasColumnType("binary(32)");
        b.Property(r => r.Outcome).HasMaxLength(10).IsUnicode(false).UseCollation(DomainModelConventions.BinaryCollation);
        b.Property(r => r.Code).HasMaxLength(100).IsUnicode(false);
    }
}

public sealed class LogoutAcknowledgementConfiguration : IEntityTypeConfiguration<LogoutAcknowledgement>
{
    public void Configure(EntityTypeBuilder<LogoutAcknowledgement> b)
    {
        b.ToTable("LogoutAcknowledgements");
        b.HasKey(a => new { a.AccountId, a.OperationId });
        b.HasOne<IdentityUser<Guid>>().WithMany().HasForeignKey(a => a.AccountId);
    }
}
