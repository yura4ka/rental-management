using System.Globalization;
using System.Net.Mail;
using System.Text.RegularExpressions;
using FluentValidation;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Services.Profiles;

namespace RentalManagement.Api.Validation;

public sealed class ApplicantInformationRequestValidator : AbstractValidator<ApplicantInformationRequest>
{
    public ApplicantInformationRequestValidator() => RuleFor(x => x).Custom((x, c) =>
        ProfileValidation.Contact(x.ApplicantInformation, false, (p, m) => c.AddFailure(p, m)));
}

public sealed class ApplicantInformationCommandValidator : AbstractValidator<ApplicantInformationCommand>
{
    public ApplicantInformationCommandValidator()
    {
        RuleFor(x => x.ExpectedVersion).GreaterThan(0).OverridePropertyName("expectedVersion");
        RuleFor(x => x).Custom((x, c) =>
            ProfileValidation.Contact(x.ApplicantInformation, true, (p, m) => c.AddFailure(p, m)));
    }
}

public sealed class ResidenceHistoryRequestValidator : AbstractValidator<ResidenceHistoryRequest>
{
    public ResidenceHistoryRequestValidator() => RuleFor(x => x).Custom((x, c) =>
        ProfileValidation.Residences(x.ResidenceHistory, false, DateOnly.MinValue, (p, m) => c.AddFailure(p, m)));
}

public sealed class ResidenceHistoryCommandValidator : AbstractValidator<ResidenceHistoryCommand>
{
    public ResidenceHistoryCommandValidator(TimeProvider clock)
    {
        RuleFor(x => x.ExpectedVersion).GreaterThan(0).OverridePropertyName("expectedVersion");
        RuleFor(x => x).Custom((x, c) => ProfileValidation.Residences(x.ResidenceHistory, true,
            DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime), (p, m) => c.AddFailure(p, m)));
    }
}

internal static class ProfileValidation
{
    internal static bool TryDate(string? value, out DateOnly date) => DateOnly.TryParseExact(value,
        "yyyy-MM-dd'T00:00:00Z'", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    internal static void Contact(ApplicantInformation? info, bool semantic, Action<string, string> fail)
    {
        if (info is null) { fail("applicantInformation", "Supply the contact section."); return; }
        const string p = "applicantInformation";
        Length(info.Name, 100, p + ".name", fail);
        Phone(info.Phone, p + ".phone", semantic, false, fail);
        Length(info.ContactEmail, 254, p + ".contactEmail", fail);
        if (semantic && info.ContactEmail is { } email &&
            (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !string.IsNullOrEmpty(parsed.DisplayName)))
            fail(p + ".contactEmail", "Supply a valid email address.");
        Address(info.CurrentAddress, p + ".currentAddress", semantic, false, fail);
    }

    internal static void Residences(IReadOnlyList<ResidenceInput?>? rows, bool semantic, DateOnly today,
        Action<string, string> fail)
    {
        if (rows is null) { fail("residenceHistory", "Supply a residence list, which may be empty."); return; }
        for (var i = 0; i < rows.Count; i++)
        {
            var p = $"residenceHistory[{i}]";
            if (rows[i] is not { } row) { fail(p, "Supply a residence."); continue; }
            Address(row.Address, p + ".address", semantic, true, fail);
            Length(row.LandlordName, 100, p + ".landlordName", fail);
            if (semantic && string.IsNullOrEmpty(row.LandlordName)) fail(p + ".landlordName", "Supply the landlord name.");
            Phone(row.LandlordPhone, p + ".landlordPhone", semantic, true, fail);
            if (!semantic) continue;
            var validIn = TryDate(row.MoveInDate, out var moveIn);
            var validOut = TryDate(row.MoveOutDate, out var moveOut);
            if (!validIn) fail(p + ".moveInDate", "Use YYYY-MM-DDT00:00:00Z.");
            if (!validOut) fail(p + ".moveOutDate", "Use YYYY-MM-DDT00:00:00Z.");
            if (validIn && moveIn > today) fail(p + ".moveInDate", "The date cannot be in the future.");
            if (validOut && moveOut > today) fail(p + ".moveOutDate", "The date cannot be in the future.");
            if (validIn && validOut && moveIn >= moveOut) fail(p + ".moveOutDate", "Move-out must follow move-in.");
        }
    }

    private static void Address(ProfileAddress? address, string p, bool semantic, bool required, Action<string, string> fail)
    {
        Length(address?.DisplayName, 100, p + ".displayName", fail);
        Length(address?.StreetAddress, 200, p + ".streetAddress", fail);
        Length(address?.Line2, 100, p + ".line2", fail);
        if (semantic && required && string.IsNullOrEmpty(address?.StreetAddress)) fail(p + ".streetAddress", "Supply a street address.");
    }

    private static void Phone(string? value, string path, bool semantic, bool required, Action<string, string> fail)
    {
        Length(value, 50, path, fail);
        if (semantic && ((required && value is null) || (value is not null && !Regex.IsMatch(value, @"\A[0-9]{3}-[0-9]{3}-[0-9]{4}\z"))))
            fail(path, "Use NNN-NNN-NNNN.");
    }

    private static void Length(string? value, int max, string path, Action<string, string> fail)
    {
        if (value?.Length > max) fail(path, $"Use at most {max} characters.");
    }
}
