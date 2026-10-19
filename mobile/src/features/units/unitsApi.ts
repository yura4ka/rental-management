import type { HTTPTransport } from "@/services/api";
import type {
  ArchiveUnitRequestBody,
  ArchiveUnitRequestParams,
  ArchiveUnitResponse,
  CreateUnitRequestBody,
  CreateUnitRequestParams,
  CreateUnitResponse,
  GetUnitsRequestParams,
  GetUnitsResponse,
  IUnitsApi,
  UpdateUnitRequestBody,
  UpdateUnitRequestParams,
  UpdateUnitResponse,
} from "./types";

export class UnitsApi implements IUnitsApi {
  constructor(private readonly api: HTTPTransport) {}

  getUnits(params: GetUnitsRequestParams, signal?: AbortSignal): Promise<GetUnitsResponse> {
    const { propertyId, ...query } = params;
    return this.api.fetch<GetUnitsResponse>({
      url: `/api/properties/${encodeURIComponent(propertyId)}/units`,
      params: query,
      signal,
    });
  }

  createUnit(
    params: CreateUnitRequestParams,
    body: CreateUnitRequestBody,
    signal?: AbortSignal,
  ): Promise<CreateUnitResponse> {
    return this.api.fetch<CreateUnitResponse>({
      url: `/api/properties/${encodeURIComponent(params.propertyId)}/units`,
      method: "POST",
      body,
      signal,
    });
  }

  updateUnit(
    params: UpdateUnitRequestParams,
    body: UpdateUnitRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateUnitResponse> {
    return this.api.fetch<UpdateUnitResponse>({
      url: `/api/properties/${encodeURIComponent(params.propertyId)}/units/${encodeURIComponent(params.id)}`,
      method: "PUT",
      body,
      signal,
    });
  }

  archiveUnit(
    params: ArchiveUnitRequestParams,
    body: ArchiveUnitRequestBody,
    signal?: AbortSignal,
  ): Promise<ArchiveUnitResponse> {
    return this.api.fetch<ArchiveUnitResponse>({
      url: `/api/properties/${encodeURIComponent(params.propertyId)}/units/${encodeURIComponent(params.id)}/archive`,
      method: "POST",
      body,
      signal,
    });
  }
}
