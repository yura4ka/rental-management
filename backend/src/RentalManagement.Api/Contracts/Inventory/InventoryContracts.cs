namespace RentalManagement.Api.Contracts.Inventory;

public sealed record PropertyAddress(string? DisplayName, string? StreetAddress, string? Line2);
public sealed record CreatePropertyRequest(PropertyAddress? Address);
public sealed record UpdatePropertyRequest(long ExpectedVersion, PropertyAddress? Address);
public sealed record CreateUnitRequest(string? Number, Guid UnitTypeId, int? Bedrooms, long? MonthlyRentCents);
public sealed record UpdateUnitRequest(long ExpectedVersion, string? Number, Guid UnitTypeId,
    int? Bedrooms, long? MonthlyRentCents);
public sealed record ArchiveInventoryRequest(long ExpectedVersion);
public sealed record PropertyResponse(Guid Id, PropertyAddress Address, string DisplayAddress,
    DateTimeOffset? ArchivedAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record UnitTypeResponse(Guid Id, string Code, string Name, bool IsActive, long Version);
public sealed record UnitResponse(Guid Id, Guid PropertyId, Guid UnitTypeId, string Number, int Bedrooms,
    long MonthlyRentCents, DateTimeOffset? ArchivedAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record AvailableUnitResponse(PropertyResponse Property, UnitResponse Unit, UnitTypeResponse UnitType);
public sealed record InventoryPage<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
