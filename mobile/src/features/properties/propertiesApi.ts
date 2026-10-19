import type { HTTPTransport } from "@/services/api";
import type {
  ArchivePropertyRequestBody,
  ArchivePropertyRequestParams,
  ArchivePropertyResponse,
  CreatePropertyRequestBody,
  CreatePropertyResponse,
  GetPropertiesRequestParams,
  GetPropertiesResponse,
  IPropertiesApi,
  UpdatePropertyRequestBody,
  UpdatePropertyRequestParams,
  UpdatePropertyResponse,
} from "./types";

export class PropertiesApi implements IPropertiesApi {
  constructor(private readonly api: HTTPTransport) {}

  getProperties(
    params: GetPropertiesRequestParams = {},
    signal?: AbortSignal,
  ): Promise<GetPropertiesResponse> {
    return this.api.fetch<GetPropertiesResponse>({ url: "/api/properties", params, signal });
  }

  createProperty(
    body: CreatePropertyRequestBody,
    signal?: AbortSignal,
  ): Promise<CreatePropertyResponse> {
    return this.api.fetch<CreatePropertyResponse>({
      url: "/api/properties",
      method: "POST",
      body,
      signal,
    });
  }

  updateProperty(
    params: UpdatePropertyRequestParams,
    body: UpdatePropertyRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdatePropertyResponse> {
    return this.api.fetch<UpdatePropertyResponse>({
      url: `/api/properties/${encodeURIComponent(params.id)}`,
      method: "PUT",
      body,
      signal,
    });
  }

  archiveProperty(
    params: ArchivePropertyRequestParams,
    body: ArchivePropertyRequestBody,
    signal?: AbortSignal,
  ): Promise<ArchivePropertyResponse> {
    return this.api.fetch<ArchivePropertyResponse>({
      url: `/api/properties/${encodeURIComponent(params.id)}/archive`,
      method: "POST",
      body,
      signal,
    });
  }
}
