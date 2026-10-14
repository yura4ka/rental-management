namespace RentalManagement.Api.Contracts.Profiles;

public sealed record ProfileAddress(string? DisplayName, string? StreetAddress, string? Line2);
public sealed record ApplicantInformation(string? Name, string? Phone, string? ContactEmail, ProfileAddress? CurrentAddress);
public sealed record ResidenceInput(ProfileAddress? Address, string? LandlordName, string? LandlordPhone,
    string? MoveInDate, string? MoveOutDate);
public sealed record ApplicantInformationRequest(long ExpectedVersion, ApplicantInformation? ApplicantInformation);
public sealed record ResidenceHistoryRequest(long ExpectedVersion, IReadOnlyList<ResidenceInput?>? ResidenceHistory);
public sealed record ResidenceResponse(int Position, ProfileAddress Address, string LandlordName,
    string LandlordPhone, string MoveInDate, string MoveOutDate);
public sealed record ApplicantProfileResponse(ApplicantInformation ApplicantInformation,
    IReadOnlyList<ResidenceResponse> ResidenceHistory, long Version);
