import type { InventoryPageDto, PropertyDto } from "../properties/types";
import type { UnitDto } from "../units/types";

export type UnitTypeDto = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  version: string;
};

export type AvailableUnitDto = {
  property: PropertyDto;
  unit: UnitDto;
  unitType: UnitTypeDto;
};

export type GetAvailableUnitsRequestParams = {
  page?: number;
  pageSize?: number;
  unitTypeIds?: string[];
  bedrooms?: number;
  /** Inclusive monthly rent bounds in integer cents, matching monthlyRentCents. */
  priceFrom?: number;
  priceTo?: number;
  sortBy?: "price" | "createdAt";
  sortDirection?: "asc" | "desc";
};

export type GetAvailableUnitsResponse = InventoryPageDto<AvailableUnitDto>;
export type GetUnitTypesResponse = UnitTypeDto[];

export interface IInventoryApi {
  getAvailableUnits(
    params?: GetAvailableUnitsRequestParams,
    signal?: AbortSignal,
  ): Promise<GetAvailableUnitsResponse>;
  getUnitTypes(signal?: AbortSignal): Promise<GetUnitTypesResponse>;
}
