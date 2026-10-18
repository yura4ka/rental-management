import type { INetwork } from "@/services/network";
import type { InventoryRepository } from "./inventoryRepository";
import type { GetAvailableUnitsRequestParams, IInventoryApi } from "./types";
import { readInventory } from "./inventoryRead";

export type InventoryRead<T> = { data: T; source: "server" | "device"; fallbackError?: unknown };

export class InventoryService {
  constructor(
    private readonly api: IInventoryApi,
    private readonly repository: InventoryRepository,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
  ) {}

  getAvailableUnits(params: GetAvailableUnitsRequestParams = {}, signal?: AbortSignal) {
    return this.read(
      (requestSignal) => this.api.getAvailableUnits(params, requestSignal),
      () => this.repository.getAvailableUnits(params),
      (response) => this.repository.saveAvailableUnits(response, params),
      signal,
    );
  }

  getUnitTypes(signal?: AbortSignal) {
    return this.read(
      (requestSignal) => this.api.getUnitTypes(requestSignal),
      () => this.repository.getUnitTypes(),
      (response) => this.repository.saveUnitTypes(response),
      signal,
    );
  }

  private async read<T>(
    fetch: (signal: AbortSignal) => Promise<T>,
    cached: () => Promise<T>,
    save: (data: T) => Promise<void>,
    querySignal?: AbortSignal,
  ): Promise<InventoryRead<T>> {
    return readInventory(this.network, this.sessionSignal, querySignal, fetch, cached, save);
  }
}
