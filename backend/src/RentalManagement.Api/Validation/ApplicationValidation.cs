using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Services.Profiles;

namespace RentalManagement.Api.Validation;

internal static class ApplicationValidation
{
    internal static ApplicantInformation Information(ApplicantInformation? input)
    {
        var errors = new Dictionary<string, string>();
        void Fail(string p, string m) => errors.TryAdd(p, m);
        ProfileValidation.Contact(input, false, Fail);
        var info = ApplicantInformationCommand.FromRequest(new(1, input)).ApplicantInformation;
        ProfileValidation.Contact(info, true, Fail);
        if (string.IsNullOrWhiteSpace(info?.Name)) Fail("applicantInformation.name", "Supply a name.");
        if (string.IsNullOrWhiteSpace(info?.Phone)) Fail("applicantInformation.phone", "Supply a phone number.");
        if (string.IsNullOrWhiteSpace(info?.ContactEmail)) Fail("applicantInformation.contactEmail", "Supply an email address.");
        if (string.IsNullOrWhiteSpace(info?.CurrentAddress?.StreetAddress))
            Fail("applicantInformation.currentAddress.streetAddress", "Supply a street address.");
        Throw(errors);
        return info!;
    }

    internal static IReadOnlyList<ResidenceInput?> Residences(ResidenceHistoryRequest input, DateOnly today)
    {
        var errors = new Dictionary<string, string>();
        void Fail(string p, string m) => errors.TryAdd(p, m);
        ProfileValidation.Residences(input.ResidenceHistory, false, today, Fail);
        var rows = ResidenceHistoryCommand.FromRequest(input).ResidenceHistory;
        ProfileValidation.Residences(rows, true, today, Fail);
        Throw(errors);
        return rows!;
    }

    internal static void Version(long version)
    {
        if (version < 1) Invalid("expectedVersion", "Supply a positive version.");
    }

    internal static string? Comment(string? comment, bool required)
    {
        if (comment?.Length > 2000) Invalid("comment", "Use at most 2000 characters.");
        var clean = ProfileMapping.Clean(comment);
        if (required && clean is null) Invalid("comment", "Supply a nonblank comment.");
        return clean;
    }

    internal static ApplicationStatus? Query(ApplicationListQuery query, bool manager)
    {
        if (query.Page < 1 || query.Page > int.MaxValue / 20) Invalid("page", "Supply a valid one-based page.");
        if (query.SortBy is not ("createdAt" or "statusChangedAt")) Invalid("sortBy", "Use createdAt or statusChangedAt.");
        if (query.SortDirection is not ("asc" or "desc")) Invalid("sortDirection", "Use asc or desc.");
        if (!manager && query.ShowArchived) Invalid("showArchived", "This option is only available to managers.");
        if (query.Status is null) return null;
        if (!Enum.TryParse<ApplicationStatus>(query.Status, out var status) || !Enum.IsDefined(status) || status.ToString() != query.Status)
            Invalid("status", "Supply a supported application status.");
        return status;
    }

    internal static void Invalid(string path, string message) => Throw(new() { [path] = message });
    private static void Throw(Dictionary<string, string> errors)
    {
        if (errors.Count != 0) throw new ApiException(422, "ValidationFailed", "Validation failed.", errors);
    }
}
