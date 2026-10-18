using System.Security.Claims;
using FluentValidation;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Validation;

namespace RentalManagement.Api.Services;

public sealed class InventoryService(ApplicationDbContext db, TimeProvider clock,
    IValidator<CreatePropertyRequest> createProperties, IValidator<UpdatePropertyRequest> updateProperties,
    IValidator<CreateUnitRequest> createUnits, IValidator<UpdateUnitRequest> updateUnits,
    IValidator<ArchiveInventoryRequest> archives)
{
    public async Task<InventoryPage<PropertyResponse>> PropertiesAsync(ClaimsPrincipal principal,
        bool includeArchived, int page, int pageSize, CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        InventoryValidation.Pagination(page, pageSize);
        var query = db.Properties.AsNoTracking().Where(p => p.OwnerManagerId == owner);
        if (!includeArchived) query = query.Where(p => p.ArchivedAt == null);
        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new(rows.Select(PropertyDto).ToArray(), total, page, pageSize);
    }

    public async Task<InventoryPage<UnitResponse>> UnitsAsync(ClaimsPrincipal principal, Guid propertyId,
        bool includeArchived, int page, int pageSize, CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        InventoryValidation.Pagination(page, pageSize);
        if (!await db.Properties.AnyAsync(p => p.Id == propertyId && p.OwnerManagerId == owner, cancellationToken))
            throw NotFound();
        var query = db.Units.AsNoTracking().Where(u => u.PropertyId == propertyId);
        if (!includeArchived) query = query.Where(u => u.ArchivedAt == null);
        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderBy(u => u.Number).ThenBy(u => u.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new(rows.Select(UnitDto).ToArray(), total, page, pageSize);
    }

    public async Task<PropertyResponse> CreatePropertyAsync(ClaimsPrincipal principal, CreatePropertyRequest request,
        CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        ValidationErrors.ThrowIfInvalid(await createProperties.ValidateAsync(request, cancellationToken));
        return await WriteAsync(async () =>
        {
            if (await db.Properties.AnyAsync(p => p.Id == request.Id, cancellationToken))
                throw new ApiException(409, "PropertyIdAlreadyUsed", "The property ID is already used.");
            var property = new Property { Id = request.Id, OwnerManagerId = owner, Address = AddressEntity(request.Address!) };
            db.Properties.Add(property);
            await db.SaveChangesAsync(cancellationToken);
            return PropertyDto(property);
        }, cancellationToken);
    }

    public async Task<PropertyResponse> UpdatePropertyAsync(ClaimsPrincipal principal, Guid id,
        UpdatePropertyRequest request, CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        ValidationErrors.ThrowIfInvalid(await updateProperties.ValidateAsync(request, cancellationToken));
        return await WriteAsync(async () =>
        {
            var property = await LockPropertyAsync(id, owner, cancellationToken);
            CheckVersion(property.Version, request.ExpectedVersion);
            property.Address = AddressEntity(request.Address!);
            db.Entry(property).Property(p => p.UpdatedAt).IsModified = true;
            await db.SaveChangesAsync(cancellationToken);
            return PropertyDto(property);
        }, cancellationToken);
    }

    public async Task<PropertyResponse> ArchivePropertyAsync(ClaimsPrincipal principal, Guid id,
        ArchiveInventoryRequest request, CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        ValidationErrors.ThrowIfInvalid(await archives.ValidateAsync(request, cancellationToken));
        return await WriteAsync(async () =>
        {
            var property = await LockPropertyAsync(id, owner, cancellationToken);
            CheckVersion(property.Version, request.ExpectedVersion);
            var units = await db.Units.Where(u => u.PropertyId == id && u.ArchivedAt == null)
                .ToListAsync(cancellationToken);
            var now = clock.GetUtcNow();
            property.ArchivedAt = now;
            foreach (var unit in units)
            {
                CheckVersion(unit.Version, unit.Version);
                unit.ArchivedAt = now;
            }
            await db.SaveChangesAsync(cancellationToken);
            return PropertyDto(property);
        }, cancellationToken);
    }

    public async Task<UnitResponse> CreateUnitAsync(ClaimsPrincipal principal, Guid propertyId, CreateUnitRequest request,
        CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        ValidationErrors.ThrowIfInvalid(await createUnits.ValidateAsync(request, cancellationToken));
        return await WriteAsync(async () =>
        {
            await LockPropertyAsync(propertyId, owner, cancellationToken);
            await ValidateTypeAsync(request.UnitTypeId, null, cancellationToken);
            if (await db.Units.AnyAsync(u => u.Id == request.Id, cancellationToken))
                throw new ApiException(409, "UnitIdAlreadyUsed", "The unit ID is already used.");
            var unit = new Unit
            {
                Id = request.Id,
                PropertyId = propertyId,
                Number = request.Number!,
                UnitTypeId = request.UnitTypeId,
                Bedrooms = request.Bedrooms!.Value,
                MonthlyRent = request.MonthlyRentCents!.Value / 100m
            };
            db.Units.Add(unit);
            db.UnitLeaseGuards.Add(new UnitLeaseGuard { UnitId = unit.Id });
            await db.SaveChangesAsync(cancellationToken);
            return UnitDto(unit);
        }, cancellationToken);
    }

    public async Task<UnitResponse> UpdateUnitAsync(ClaimsPrincipal principal, Guid propertyId, Guid id,
        UpdateUnitRequest request, CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        ValidationErrors.ThrowIfInvalid(await updateUnits.ValidateAsync(request, cancellationToken));
        return await WriteAsync(async () =>
        {
            await LockPropertyAsync(propertyId, owner, cancellationToken);
            var unit = await ActiveUnitAsync(propertyId, id, request.ExpectedVersion, cancellationToken);
            await ValidateTypeAsync(request.UnitTypeId, unit.UnitTypeId, cancellationToken);
            unit.Number = request.Number!;
            unit.UnitTypeId = request.UnitTypeId;
            unit.Bedrooms = request.Bedrooms!.Value;
            unit.MonthlyRent = request.MonthlyRentCents!.Value / 100m;
            db.Entry(unit).Property(u => u.UpdatedAt).IsModified = true;
            await db.SaveChangesAsync(cancellationToken);
            return UnitDto(unit);
        }, cancellationToken);
    }

    public async Task<UnitResponse> ArchiveUnitAsync(ClaimsPrincipal principal, Guid propertyId, Guid id,
        ArchiveInventoryRequest request, CancellationToken cancellationToken)
    {
        var owner = ManagerId(principal);
        ValidationErrors.ThrowIfInvalid(await archives.ValidateAsync(request, cancellationToken));
        return await WriteAsync(async () =>
        {
            await LockPropertyAsync(propertyId, owner, cancellationToken);
            var unit = await ActiveUnitAsync(propertyId, id, request.ExpectedVersion, cancellationToken);
            unit.ArchivedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(cancellationToken);
            return UnitDto(unit);
        }, cancellationToken);
    }

    public async Task<InventoryPage<AvailableUnitResponse>> AvailableAsync(AvailableUnitsQuery request,
        CancellationToken cancellationToken)
    {
        InventoryValidation.AvailableUnits(request);
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var query = from unit in db.Units.AsNoTracking()
                    join property in db.Properties.AsNoTracking() on unit.PropertyId equals property.Id
                    join type in db.UnitTypes.AsNoTracking() on unit.UnitTypeId equals type.Id
                    where unit.ArchivedAt == null && property.ArchivedAt == null &&
                        !(from lease in db.Leases
                          join application in db.RentalApplications on lease.ApplicationId equals application.Id
                          where application.UnitId == unit.Id && lease.StartDate <= today && today < lease.EndDateExclusive
                          select lease.Id).Any()
                     select new { Unit = unit, Property = property, Type = type };
        if (request.UnitTypeIds is { Length: > 0 } typeIds)
            query = query.Where(r => typeIds.Contains(r.Unit.UnitTypeId));
        if (request.Bedrooms is { } bedrooms)
            query = query.Where(r => r.Unit.Bedrooms == bedrooms);
        if (request.PriceFrom is { } priceFrom)
        {
            var minimumRent = priceFrom / 100m;
            query = query.Where(r => r.Unit.MonthlyRent >= minimumRent);
        }
        if (request.PriceTo is { } priceTo)
        {
            var maximumRent = priceTo / 100m;
            query = query.Where(r => r.Unit.MonthlyRent <= maximumRent);
        }

        var total = await query.CountAsync(cancellationToken);
        var ordered = (request.SortBy, request.SortDirection) switch
        {
            ("price", "asc") => query.OrderBy(r => r.Unit.MonthlyRent),
            ("price", "desc") => query.OrderByDescending(r => r.Unit.MonthlyRent),
            ("createdAt", "asc") => query.OrderBy(r => r.Unit.CreatedAt),
            ("createdAt", "desc") => query.OrderByDescending(r => r.Unit.CreatedAt),
            _ => query.OrderBy(r => r.Property.Id).ThenBy(r => r.Unit.Number)
        };
        var rows = await ordered.ThenBy(r => r.Unit.Id)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize).ToListAsync(cancellationToken);
        return new(rows.Select(r => new AvailableUnitResponse(PropertyDto(r.Property), UnitDto(r.Unit),
            TypeDto(r.Type))).ToArray(), total, request.Page, request.PageSize);
    }

    public async Task<IReadOnlyList<UnitTypeResponse>> TypesAsync(CancellationToken cancellationToken) =>
        (await db.UnitTypes.AsNoTracking().OrderBy(t => t.Name).ThenBy(t => t.Id)
            .ToListAsync(cancellationToken)).Select(TypeDto).ToArray();

    private async Task<Property> LockPropertyAsync(Guid id, Guid owner, CancellationToken cancellationToken)
    {
        var property = await db.Properties.FromSqlInterpolated(
                $"SELECT * FROM [Properties] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id} AND [OwnerManagerId] = {owner}")
            .SingleOrDefaultAsync(cancellationToken) ?? throw NotFound();
        if (property.ArchivedAt is not null) throw Archived();
        return property;
    }

    private async Task<Unit> ActiveUnitAsync(Guid propertyId, Guid id, long expectedVersion,
        CancellationToken cancellationToken)
    {
        var unit = await db.Units.SingleOrDefaultAsync(u => u.Id == id && u.PropertyId == propertyId, cancellationToken)
            ?? throw NotFound();
        if (unit.ArchivedAt is not null) throw Archived();
        CheckVersion(unit.Version, expectedVersion);
        return unit;
    }

    private async Task ValidateTypeAsync(Guid id, Guid? currentId, CancellationToken cancellationToken)
    {
        var type = await db.UnitTypes.FromSqlInterpolated(
                $"SELECT * FROM [UnitTypes] WITH (HOLDLOCK) WHERE [Id] = {id}")
            .SingleOrDefaultAsync(cancellationToken);
        if (type is null || (!type.IsActive && currentId != id))
            throw new ApiException(422, "ValidationFailed", "Validation failed.",
                new Dictionary<string, string> { ["unitTypeId"] = "Select an active unit type." });
    }

    private async Task<T> WriteAsync<T>(Func<Task<T>> write, CancellationToken cancellationToken)
    {
        try
        {
            await using var transaction = db.Database.CurrentTransaction is null
                ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
            var response = await write();
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return response;
        }
        catch (DbUpdateConcurrencyException) { throw Stale(); }
        catch (DbUpdateException exception) when (exception.InnerException is SqlException { Number: 2601 or 2627 })
        {
            throw new ApiException(409, "DuplicateUnitNumber", "The unit number is already used in this property.");
        }
        catch (Exception exception) when (exception is SqlException { Number: 1205 } ||
            exception.InnerException is SqlException { Number: 1205 })
        {
            throw new ApiException(503, "InventoryWriteUnavailable", "The inventory write could not complete. Retry the request.");
        }
    }

    private static Guid ManagerId(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            throw new ApiException(401, "Unauthenticated", "Authentication required.");
        if (!principal.IsInRole(AccountRoles.PropertyManager))
            throw new ApiException(403, "Forbidden", "Property manager access required.");
        return id;
    }

    private static void CheckVersion(long actual, long expected)
    {
        if (actual != expected) throw Stale();
        if (actual == long.MaxValue)
            throw new ApiException(409, "InventoryVersionExhausted", "The inventory cannot be updated.");
    }

    private static ApiException Stale() => new(409, "StaleVersion", "The inventory has changed. Reload it before saving.");
    private static ApiException Archived() => new(409, "InventoryArchived", "Archived inventory cannot be maintained.");
    private static ApiException NotFound() => new(404, "InventoryNotFound", "Inventory not found.");
    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static Address AddressEntity(PropertyAddress address) => new()
    { DisplayName = Optional(address.DisplayName), StreetAddress = address.StreetAddress!.Trim(), Line2 = Optional(address.Line2) };
    private static PropertyResponse PropertyDto(Property p) => new(p.Id,
        new(p.Address.DisplayName, p.Address.StreetAddress, p.Address.Line2),
        string.Join(", ", new[] { p.Address.DisplayName, p.Address.StreetAddress, p.Address.Line2 }
            .Where(s => !string.IsNullOrWhiteSpace(s))), p.ArchivedAt, p.CreatedAt, p.UpdatedAt, p.Version);
    private static UnitResponse UnitDto(Unit u) => new(u.Id, u.PropertyId, u.UnitTypeId, u.Number, u.Bedrooms,
        decimal.ToInt64(u.MonthlyRent * 100m), u.ArchivedAt, u.CreatedAt, u.UpdatedAt, u.Version);
    private static UnitTypeResponse TypeDto(UnitType t) => new(t.Id, t.Code, t.Name, t.IsActive, t.Version);
}
