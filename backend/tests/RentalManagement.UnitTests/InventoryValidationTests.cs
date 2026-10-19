using System.Text.Json;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Validation;

namespace RentalManagement.UnitTests;

public sealed class InventoryValidationTests
{
    [Theory]
    [InlineData("")]
    [InlineData("a1")]
    [InlineData(" A1")]
    [InlineData("A1 ")]
    [InlineData("A1\n")]
    [InlineData("Ａ1")]
    [InlineData("A/1")]
    [InlineData("123456789012345678901")]
    public async Task UnitNumberIsRejectedWithoutNormalization(string number)
    {
        var result = await new CreateUnitRequestValidator().ValidateAsync(new CreateUnitRequest(number, Guid.NewGuid(), 0, 1));
        Assert.Contains(result.Errors, e => e.PropertyName == "number");
    }

    [Theory]
    [InlineData("A")]
    [InlineData("A_1-20")]
    [InlineData("12345678901234567890")]
    public async Task ValidNumbersAndMoneyBoundariesAreAccepted(string number)
    {
        var validator = new CreateUnitRequestValidator();
        Assert.True((await validator.ValidateAsync(new CreateUnitRequest(number, Guid.NewGuid(), 0, 1))).IsValid);
        Assert.True((await validator.ValidateAsync(new CreateUnitRequest(number, Guid.NewGuid(), int.MaxValue, 999999999999))).IsValid);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0L)]
    [InlineData(-1L)]
    [InlineData(1000000000000L)]
    public async Task RentMustFitPositiveSqlDecimalCents(long? cents)
    {
        var result = await new CreateUnitRequestValidator().ValidateAsync(new CreateUnitRequest("A", Guid.NewGuid(), 0, cents));
        Assert.Contains(result.Errors, e => e.PropertyName == "monthlyRentCents");
    }

    [Fact]
    public async Task MissingFieldsAndInvalidVersionsUseExactPaths()
    {
        var result = await new UpdateUnitRequestValidator().ValidateAsync(new UpdateUnitRequest(0, null, Guid.Empty, null, null));
        Assert.Equal(new[] { "bedrooms", "expectedVersion", "monthlyRentCents", "number", "unitTypeId" },
            result.Errors.Select(e => e.PropertyName).Order());
        Assert.False((await new CreateUnitRequestValidator().ValidateAsync(new CreateUnitRequest("A", Guid.NewGuid(), -1, 100))).IsValid);
        Assert.False((await new ArchiveInventoryRequestValidator().ValidateAsync(new ArchiveInventoryRequest(0))).IsValid);
    }

    [Fact]
    public async Task AddressRequiresStreetAndChecksRawLengthLimits()
    {
        var validator = new CreatePropertyRequestValidator();
        Assert.False((await validator.ValidateAsync(new CreatePropertyRequest(null))).IsValid);
        Assert.False((await validator.ValidateAsync(new CreatePropertyRequest(new(null, " \t", null)))).IsValid);
        Assert.True((await validator.ValidateAsync(new CreatePropertyRequest(new(null, "123 Main", null)))).IsValid);
        var result = await validator.ValidateAsync(new CreatePropertyRequest(new(new string(' ', 101), new string('X', 201), new string('X', 101))));
        Assert.Equal(new[] { "address.displayName", "address.line2", "address.streetAddress" },
            result.Errors.Select(e => e.PropertyName).Order());
    }

    [Theory]
    [InlineData(0, 20)]
    [InlineData(1, 0)]
    [InlineData(1, 101)]
    [InlineData(int.MaxValue, 100)]
    public void InvalidPaginationIsRejected(int page, int size) =>
        Assert.Equal(422, Assert.Throws<ApiException>(() => InventoryValidation.Pagination(page, size)).Status);

    [Fact]
    public void AvailableUnitsAcceptOptionalFiltersAndInclusiveCentsBoundaries()
    {
        InventoryValidation.AvailableUnits(new());
        InventoryValidation.AvailableUnits(new() { UnitTypeIds = [], Bedrooms = 0, PriceFrom = 0, PriceTo = 999999999999 });
        foreach (var sort in new[] { "price", "createdAt" })
        foreach (var direction in new[] { "asc", "desc" })
            InventoryValidation.AvailableUnits(new()
            {
                UnitTypeIds = [Guid.NewGuid()], PriceFrom = 12345, PriceTo = 12345,
                SortBy = sort, SortDirection = direction
            });
    }

    [Fact]
    public void AvailableUnitsRejectInvalidFiltersWithExactPaths()
    {
        var invalid = new (AvailableUnitsQuery Query, string Field)[]
        {
            (new() { UnitTypeIds = [Guid.Empty] }, "unitTypeIds"),
            (new() { Bedrooms = -1 }, "bedrooms"),
            (new() { PriceFrom = -1 }, "priceFrom"),
            (new() { PriceTo = -1 }, "priceTo"),
            (new() { PriceFrom = 1000000000000 }, "priceFrom"),
            (new() { PriceTo = 1000000000000 }, "priceTo"),
            (new() { PriceFrom = 101, PriceTo = 100 }, "priceTo"),
            (new() { SortBy = "monthlyRentCents" }, "sortBy"),
            (new() { SortBy = "" }, "sortBy"),
            (new() { SortDirection = "ASC" }, "sortDirection"),
            (new() { Page = 0 }, "page"),
            (new() { PageSize = 101 }, "pageSize")
        };
        foreach (var (query, field) in invalid)
        {
            var error = Assert.Throws<ApiException>(() => InventoryValidation.AvailableUnits(query));
            Assert.Equal(422, error.Status);
            Assert.Contains(field, error.Fields!.Keys);
        }
    }

    [Fact]
    public void VersionsAreStringsButRentRemainsAnInteger()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver
            { Modifiers = { VersionJsonConverter.Configure } }
        };
        var request = new UpdateUnitRequest(123, "A", Guid.NewGuid(), 0, 12345);
        var json = JsonSerializer.SerializeToElement(request, options);
        Assert.Equal("123", json.GetProperty("expectedVersion").GetString());
        Assert.Equal(12345, json.GetProperty("monthlyRentCents").GetInt64());
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CreateUnitRequest>(
            """{"number":"A","bedrooms":0,"monthlyRentCents":1.5}""", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ArchiveInventoryRequest>("""{"expectedVersion":1}""", options));
    }
}
