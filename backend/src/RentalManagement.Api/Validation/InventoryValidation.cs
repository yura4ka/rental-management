using System.Text.RegularExpressions;
using FluentValidation;
using FluentValidation.Results;
using RentalManagement.Api.Contracts.Inventory;

namespace RentalManagement.Api.Validation;

internal static partial class InventoryValidation
{
    internal static ValidationResult Address(PropertyAddress? address)
    {
        var errors = new List<ValidationFailure>();
        if (address is null) errors.Add(new("address", "Supply an address."));
        else
        {
            if (string.IsNullOrWhiteSpace(address.StreetAddress))
                errors.Add(new("address.streetAddress", "Supply the street address."));
            Length(address.DisplayName, 100, "address.displayName", errors);
            Length(address.StreetAddress, 200, "address.streetAddress", errors);
            Length(address.Line2, 100, "address.line2", errors);
        }
        return new ValidationResult(errors);
    }

    internal static ValidationResult Unit(string? number, Guid typeId, int? bedrooms, long? cents)
    {
        var errors = new List<ValidationFailure>();
        if (number is null || !UnitNumber().IsMatch(number))
            errors.Add(new("number", "Use 1–20 characters from A–Z, 0–9, _ or -."));
        if (typeId == Guid.Empty) errors.Add(new("unitTypeId", "Supply a unit type."));
        if (bedrooms is null or < 0) errors.Add(new("bedrooms", "Supply a nonnegative integer."));
        if (cents is null or <= 0 or > 999999999999L)
            errors.Add(new("monthlyRentCents", "Supply integer cents between 1 and 999999999999."));
        return new ValidationResult(errors);
    }

    internal static ValidationResult Version(long version) => new(
        version > 0 ? [] : new[] { new ValidationFailure("expectedVersion", "Supply a positive version.") });

    internal static void Pagination(int page, int pageSize)
    {
        var errors = new List<ValidationFailure>();
        if (page < 1 || (long)(page - 1) * pageSize > int.MaxValue)
            errors.Add(new("page", "Supply a positive page within the supported range."));
        if (pageSize is < 1 or > 100) errors.Add(new("pageSize", "Use a page size between 1 and 100."));
        ValidationErrors.ThrowIfInvalid(new ValidationResult(errors));
    }

    private static void Length(string? value, int limit, string path, List<ValidationFailure> errors)
    {
        if (value?.Length > limit) errors.Add(new(path, $"Use at most {limit} characters."));
    }

    [GeneratedRegex(@"\A[A-Z0-9_-]{1,20}\z", RegexOptions.CultureInvariant)]
    private static partial Regex UnitNumber();
}

public sealed class CreatePropertyRequestValidator : AbstractValidator<CreatePropertyRequest>
{
    public CreatePropertyRequestValidator() => RuleFor(x => x).Custom((x, c) =>
    {
        foreach (var error in InventoryValidation.Address(x.Address).Errors) c.AddFailure(error);
    });
}

public sealed class UpdatePropertyRequestValidator : AbstractValidator<UpdatePropertyRequest>
{
    public UpdatePropertyRequestValidator() => RuleFor(x => x).Custom((x, c) =>
    {
        foreach (var error in InventoryValidation.Address(x.Address).Errors
            .Concat(InventoryValidation.Version(x.ExpectedVersion).Errors)) c.AddFailure(error);
    });
}

public sealed class CreateUnitRequestValidator : AbstractValidator<CreateUnitRequest>
{
    public CreateUnitRequestValidator() => RuleFor(x => x).Custom((x, c) =>
    {
        foreach (var error in InventoryValidation.Unit(x.Number, x.UnitTypeId, x.Bedrooms, x.MonthlyRentCents).Errors)
            c.AddFailure(error);
    });
}

public sealed class UpdateUnitRequestValidator : AbstractValidator<UpdateUnitRequest>
{
    public UpdateUnitRequestValidator() => RuleFor(x => x).Custom((x, c) =>
    {
        foreach (var error in InventoryValidation.Unit(x.Number, x.UnitTypeId, x.Bedrooms, x.MonthlyRentCents).Errors
            .Concat(InventoryValidation.Version(x.ExpectedVersion).Errors)) c.AddFailure(error);
    });
}

public sealed class ArchiveInventoryRequestValidator : AbstractValidator<ArchiveInventoryRequest>
{
    public ArchiveInventoryRequestValidator() => RuleFor(x => x).Custom((x, c) =>
    {
        foreach (var error in InventoryValidation.Version(x.ExpectedVersion).Errors) c.AddFailure(error);
    });
}
