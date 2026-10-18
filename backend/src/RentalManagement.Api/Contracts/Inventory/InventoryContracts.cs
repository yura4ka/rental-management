using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Contracts.Operations;

namespace RentalManagement.Api.Contracts.Inventory;

public sealed record PropertyAddress(string? DisplayName, string? StreetAddress, string? Line2);
public sealed record CreatePropertyRequest(PropertyAddress? Address) : OperationRequest, ICreateResourceRequest
{
    [JsonRequired]
    public Guid Id { get; init; }
}
public sealed record UpdatePropertyRequest(long ExpectedVersion, PropertyAddress? Address) : OperationRequest;
public sealed record CreateUnitRequest(string? Number, Guid UnitTypeId, int? Bedrooms, long? MonthlyRentCents)
    : OperationRequest, ICreateResourceRequest
{
    [JsonRequired]
    public Guid Id { get; init; }
}
public sealed record UpdateUnitRequest(long ExpectedVersion, string? Number, Guid UnitTypeId,
    int? Bedrooms, long? MonthlyRentCents) : OperationRequest;
public sealed record ArchiveInventoryRequest(long ExpectedVersion) : OperationRequest;
public sealed record PropertyResponse(Guid Id, PropertyAddress Address, string DisplayAddress,
    DateTimeOffset? ArchivedAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record UnitTypeResponse(Guid Id, string Code, string Name, bool IsActive, long Version);
public sealed record UnitResponse(Guid Id, Guid PropertyId, Guid UnitTypeId, string Number, int Bedrooms,
    long MonthlyRentCents, DateTimeOffset? ArchivedAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record AvailableUnitResponse(PropertyResponse Property, UnitResponse Unit, UnitTypeResponse UnitType);
public sealed record AvailableUnitsQuery
{
    [FromQuery(Name = "page")]
    public int Page { get; init; } = 1;
    [FromQuery(Name = "pageSize")]
    public int PageSize { get; init; } = 20;
    [FromQuery(Name = "unitTypeIds")]
    public Guid[]? UnitTypeIds { get; init; }
    [FromQuery(Name = "bedrooms")]
    public int? Bedrooms { get; init; }
    // Inclusive monthly rent bounds in integer cents, matching UnitResponse.MonthlyRentCents.
    [FromQuery(Name = "priceFrom")]
    public long? PriceFrom { get; init; }
    [FromQuery(Name = "priceTo")]
    public long? PriceTo { get; init; }
    [FromQuery(Name = "sortBy")]
    public string? SortBy { get; init; }
    [FromQuery(Name = "sortDirection")]
    public string SortDirection { get; init; } = "asc";
}
public sealed record InventoryPage<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
