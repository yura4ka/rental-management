import {
  defaultInventoryFilters,
  inventoryFiltersSchema,
  priceToCents,
  toInventoryParams,
  toSortParams,
} from "./forms";

describe("inventory filters", () => {
  it("leaves all filters optional, including zero-bedroom units by default", () => {
    expect(toInventoryParams(defaultInventoryFilters)).toEqual({
      unitTypeIds: undefined,
      bedrooms: undefined,
      priceFrom: undefined,
      priceTo: undefined,
    });
  });
  it("converts decimal USD to exact integer cents", () => {
    expect(priceToCents(" 12.01 ")).toBe(1201);
    expect(priceToCents("0.29")).toBe(29);
    expect(priceToCents("10.1")).toBe(1010);
    expect(priceToCents("0")).toBe(0);
    expect(priceToCents("")).toBeUndefined();
  });
  it.each(["-1", "1.001", "abc", "1e3", "10000000000", "9999999999.99x"])(
    "rejects invalid prices: %s",
    (priceFrom) => {
      expect(
        inventoryFiltersSchema.safeParse({ ...defaultInventoryFilters, priceFrom }).success,
      ).toBe(false);
    },
  );
  it("checks inclusive bounds and optional exact bedroom limits", () => {
    expect(
      inventoryFiltersSchema.safeParse({ ...defaultInventoryFilters, priceFrom: "2", priceTo: "1" })
        .success,
    ).toBe(false);
    expect(
      inventoryFiltersSchema.safeParse({ ...defaultInventoryFilters, priceFrom: "2", priceTo: "2" })
        .success,
    ).toBe(true);
    for (const bedrooms of [0, 11, 1.5])
      expect(
        inventoryFiltersSchema.safeParse({ ...defaultInventoryFilters, bedrooms }).success,
      ).toBe(false);
  });
  it("canonicalizes multi-selection and maps sorting to API fields", () => {
    expect(
      toInventoryParams({ ...defaultInventoryFilters, unitTypeIds: ["b", "a"], bedrooms: 10 })
        .unitTypeIds,
    ).toEqual(["a", "b"]);
    expect(toSortParams("price-desc")).toEqual({ sortBy: "price", sortDirection: "desc" });
    expect(toSortParams("createdAt-asc")).toEqual({ sortBy: "createdAt", sortDirection: "asc" });
    expect(toSortParams("default")).toEqual({});
  });
});
