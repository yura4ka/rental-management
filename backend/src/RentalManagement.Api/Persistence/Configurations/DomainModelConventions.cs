using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Configurations;

internal static class DomainModelConventions
{
    internal const string BinaryCollation = "Latin1_General_100_BIN2";

    internal static void Address<T>(EntityTypeBuilder<T> builder, Expression<Func<T, Address?>> member,
        string prefix, bool complete) where T : class
    {
        var address = builder.ComplexProperty(member);
        address.IsRequired();
        address.Property(a => a.DisplayName).HasColumnName(prefix + "DisplayName").HasMaxLength(100);
        address.Property(a => a.StreetAddress).HasColumnName(prefix + "StreetAddress").HasMaxLength(200).IsRequired(complete);
        address.Property(a => a.Line2).HasColumnName(prefix + "Line2").HasMaxLength(100);
        var table = builder.Metadata.GetTableName()!;
        foreach (var part in new[] { "DisplayName", "StreetAddress", "Line2" })
        {
            var column = prefix + part;
            builder.ToTable(t => t.HasCheckConstraint($"CK_{table}_{column}_Nonblank",
                $"[{column}] IS NULL OR LEN(LTRIM(RTRIM([{column}]))) > 0"));
        }
    }

    internal static void Phone<T>(EntityTypeBuilder<T> builder, string column) where T : class
    {
        builder.Property<string>(column).HasMaxLength(50);
        var pattern = "[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]";
        builder.ToTable(t => t.HasCheckConstraint($"CK_{builder.Metadata.GetTableName()}_{column}",
            $"[{column}] IS NULL OR (DATALENGTH([{column}]) = 24 AND [{column}] COLLATE {BinaryCollation} LIKE N'{pattern}')"));
    }

    internal static void Apply(ModelBuilder builder)
    {
        foreach (var entity in builder.Model.GetEntityTypes().Where(e => e.ClrType.Namespace == typeof(Property).Namespace).ToList())
        {
            var config = builder.Entity(entity.ClrType);
            var table = entity.GetTableName()!;
            if (entity.FindProperty("Id") is not null) config.Property("Id").ValueGeneratedNever();
            if (entity.FindProperty("Version") is not null)
            {
                config.Property<long>("Version").HasDefaultValue(1L).IsConcurrencyToken();
                config.ToTable(t => t.HasCheckConstraint($"CK_{table}_Version", "[Version] >= 1"));
            }
            foreach (var property in entity.GetProperties())
            {
                if (property.ClrType == typeof(DateTimeOffset) || property.ClrType == typeof(DateTimeOffset?))
                {
                    config.Property(property.Name).HasColumnType("datetimeoffset(7)");
                    config.ToTable(t => t.HasCheckConstraint($"CK_{table}_{property.Name}_Utc",
                        $"[{property.Name}] IS NULL OR DATEPART(TZOFFSET, [{property.Name}]) = 0"));
                }
                if (property.ClrType == typeof(string) && property.Name != "Body")
                    config.ToTable(t => t.HasCheckConstraint($"CK_{table}_{property.Name}_Nonblank",
                        $"[{property.Name}] IS NULL OR LEN(LTRIM(RTRIM([{property.Name}]))) > 0"));
            }
        }
    }
}
