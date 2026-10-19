import type { AvailableUnitDto, GetAvailableUnitsResponse } from "../types";

export const availableUnit: AvailableUnitDto = {
  property: {
    id: "property",
    address: { displayName: "Garden", streetAddress: "12 Main St", line2: null },
    displayAddress: "Garden, 12 Main St",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    version: "9007199254740993",
  },
  unit: {
    id: "unit",
    propertyId: "property",
    unitTypeId: "type",
    number: "A1",
    bedrooms: 2,
    monthlyRentCents: 150050,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    version: "9007199254740993",
  },
  unitType: { id: "type", code: "apartment", name: "Apartment", isActive: true, version: "1" },
};

export const availablePage: GetAvailableUnitsResponse = {
  items: [availableUnit],
  page: 1,
  pageSize: 20,
  totalCount: 1,
};
