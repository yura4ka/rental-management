using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Contracts.Operations;

namespace RentalManagement.Api.Contracts.Applications;

public sealed record CreateApplicationRequest(Guid Id, Guid UnitId, ApplicantInformation? ApplicantInformation)
    : OperationRequest, ICreateResourceRequest, IUnitTargetRequest;
public sealed record ApplicationActionRequest(long ExpectedVersion, string? Comment = null) : OperationRequest;
public sealed record SaveManagerNoteRequest([property: JsonRequired] long? ExpectedVersion, string? Body) : OperationRequest;
public sealed record RejectAllApplicationsRequest(string? Comment) : OperationRequest;
public sealed record RejectAllApplicationsResponse(int AffectedCount);
public sealed record ApplicationListQuery
{
    [FromQuery(Name = "page")]
    public int Page { get; init; } = 1;
    [FromQuery(Name = "status")]
    public string? Status { get; init; }
    [FromQuery(Name = "propertyId")]
    public Guid? PropertyId { get; init; }
    [FromQuery(Name = "showArchived")]
    public bool ShowArchived { get; init; }
    [FromQuery(Name = "sortBy")]
    public string SortBy { get; init; } = "createdAt";
    [FromQuery(Name = "sortDirection")]
    public string SortDirection { get; init; } = "desc";
}
public sealed record ApplicationPage(IReadOnlyList<ApplicationRow> Rows, int Total, int Page, int PageSize);
public sealed record ApplicationRow(Guid Id, Guid ApplicantId, Guid UnitId, Guid PropertyId,
    string UnitNumber, ProfileAddress PropertyAddress, bool IsArchived, string ApplicantName, string Status,
    DateTimeOffset CreatedAt, DateTimeOffset StatusChangedAt, long Version);
public sealed record ApplicationHistoryResponse(Guid Id, long Sequence, Guid ActorUserId, string Action,
    string? FromStatus, string ToStatus, string? Comment, DateTimeOffset OccurredAt);
public sealed record ApplicationLeaseResponse(Guid Id, string StartDate, string EndDateExclusive, DateTimeOffset ApprovedAt);
public sealed record ManagerNoteResponse(string Body, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record ApplicationDetailResponse(ApplicationRow Application, ApplicantInformation ApplicantInformation,
    IReadOnlyList<ResidenceResponse> ResidenceHistory, DateTimeOffset ApplicantInformationSavedAt,
    DateTimeOffset? ResidenceHistorySavedAt, IReadOnlyList<ApplicationHistoryResponse> History,
    ApplicationLeaseResponse? Lease, ManagerNoteResponse? MyNote);
