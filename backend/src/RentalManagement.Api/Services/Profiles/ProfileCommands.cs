using RentalManagement.Api.Contracts.Profiles;

namespace RentalManagement.Api.Services.Profiles;

public sealed record ApplicantInformationCommand(long ExpectedVersion, ApplicantInformation? ApplicantInformation)
{
    public static ApplicantInformationCommand FromRequest(ApplicantInformationRequest request) =>
        new(request.ExpectedVersion, request.ApplicantInformation is { } info
            ? new(ProfileMapping.Clean(info.Name), ProfileMapping.Clean(info.Phone), ProfileMapping.Clean(info.ContactEmail),
                ProfileMapping.Clean(info.CurrentAddress)) : null);
}

public sealed record ResidenceHistoryCommand(long ExpectedVersion, IReadOnlyList<ResidenceInput?>? ResidenceHistory)
{
    public static ResidenceHistoryCommand FromRequest(ResidenceHistoryRequest request) =>
        new(request.ExpectedVersion, request.ResidenceHistory?.Select(r => r is null ? null :
            new ResidenceInput(ProfileMapping.Clean(r.Address), ProfileMapping.Clean(r.LandlordName),
                ProfileMapping.Clean(r.LandlordPhone), r.MoveInDate, r.MoveOutDate)).ToArray());
}

internal static class ProfileMapping
{
    internal static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    internal static ProfileAddress Clean(ProfileAddress? address) =>
        new(Clean(address?.DisplayName), Clean(address?.StreetAddress), Clean(address?.Line2));
}
