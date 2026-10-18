import type { HTTPTransport } from "@/services/api";
import type {
  GetAvailableUnitsRequestParams,
  GetAvailableUnitsResponse,
  GetUnitTypesResponse,
  IInventoryApi,
} from "./types";

export class InventoryApi implements IInventoryApi {
  constructor(private readonly api: HTTPTransport) {}

  getAvailableUnits(
    params: GetAvailableUnitsRequestParams = {},
    signal?: AbortSignal,
  ): Promise<GetAvailableUnitsResponse> {
    return this.api.fetch<GetAvailableUnitsResponse>({
      url: "/api/available-units",
      params,
      signal,
    });
  }

  getUnitTypes(signal?: AbortSignal): Promise<GetUnitTypesResponse> {
    return this.api.fetch<GetUnitTypesResponse>({ url: "/api/unit-types", signal });
  }
}
