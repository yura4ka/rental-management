import type { MutationResponse, OperationRequestBody } from "../operations/types";

export type PropertyAddressDto = {
  displayName: string | null;
  streetAddress: string | null;
  line2: string | null;
};

export type PropertyDto = {
  id: string;
  address: PropertyAddressDto;
  displayAddress: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: string;
};

export type InventoryPageDto<Data> = {
  items: Data[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type GetPropertiesRequestParams = {
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

export type GetPropertiesResponse = InventoryPageDto<PropertyDto>;

export type CreatePropertyRequestBody = OperationRequestBody & {
  id: string;
  address: PropertyAddressDto | null;
};

export type CreatePropertyResponse = MutationResponse<PropertyDto>;

export type UpdatePropertyRequestParams = { id: string };

export type UpdatePropertyRequestBody = OperationRequestBody & {
  expectedVersion: string;
  address: PropertyAddressDto | null;
};

export type UpdatePropertyResponse = MutationResponse<PropertyDto>;

export type ArchivePropertyRequestParams = { id: string };

export type ArchivePropertyRequestBody = OperationRequestBody & {
  expectedVersion: string;
};

export type ArchivePropertyResponse = MutationResponse<PropertyDto>;

export interface IPropertiesApi {
  getProperties(
    params?: GetPropertiesRequestParams,
    signal?: AbortSignal,
  ): Promise<GetPropertiesResponse>;
  createProperty(
    body: CreatePropertyRequestBody,
    signal?: AbortSignal,
  ): Promise<CreatePropertyResponse>;
  updateProperty(
    params: UpdatePropertyRequestParams,
    body: UpdatePropertyRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdatePropertyResponse>;
  archiveProperty(
    params: ArchivePropertyRequestParams,
    body: ArchivePropertyRequestBody,
    signal?: AbortSignal,
  ): Promise<ArchivePropertyResponse>;
}
