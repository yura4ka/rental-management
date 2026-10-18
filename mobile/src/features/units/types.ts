import type { MutationResponse, OperationRequestBody } from "../operations/types";
import type { InventoryPageDto } from "../properties/types";

export type UnitDto = {
  id: string;
  propertyId: string;
  unitTypeId: string;
  number: string;
  bedrooms: number;
  monthlyRentCents: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: string;
};

export type GetUnitsRequestParams = {
  propertyId: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

export type GetUnitsResponse = InventoryPageDto<UnitDto>;
export type CreateUnitRequestParams = { propertyId: string };

export type CreateUnitRequestBody = OperationRequestBody & {
  id: string;
  number: string | null;
  unitTypeId: string;
  bedrooms: number | null;
  monthlyRentCents: number | null;
};

export type CreateUnitResponse = MutationResponse<UnitDto>;

export type UpdateUnitRequestParams = {
  propertyId: string;
  id: string;
};

export type UpdateUnitRequestBody = OperationRequestBody & {
  expectedVersion: string;
  number: string | null;
  unitTypeId: string;
  bedrooms: number | null;
  monthlyRentCents: number | null;
};

export type UpdateUnitResponse = MutationResponse<UnitDto>;
export type ArchiveUnitRequestParams = UpdateUnitRequestParams;

export type ArchiveUnitRequestBody = OperationRequestBody & {
  expectedVersion: string;
};

export type ArchiveUnitResponse = MutationResponse<UnitDto>;

export interface IUnitsApi {
  getUnits(params: GetUnitsRequestParams, signal?: AbortSignal): Promise<GetUnitsResponse>;
  createUnit(
    params: CreateUnitRequestParams,
    body: CreateUnitRequestBody,
    signal?: AbortSignal,
  ): Promise<CreateUnitResponse>;
  updateUnit(
    params: UpdateUnitRequestParams,
    body: UpdateUnitRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateUnitResponse>;
  archiveUnit(
    params: ArchiveUnitRequestParams,
    body: ArchiveUnitRequestBody,
    signal?: AbortSignal,
  ): Promise<ArchiveUnitResponse>;
}
