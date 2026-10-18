import { HTTPError, NetworkError } from "@/services/api";
import type { INetwork } from "@/services/network";
import type { InventoryRepository } from "./inventoryRepository";
import type { GetAvailableUnitsRequestParams, IInventoryApi } from "./types";

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
    const controller = new AbortController();
    const abort = () => controller.abort();
    const signals = [this.sessionSignal, ...(querySignal ? [querySignal] : [])];
    for (const signal of signals) {
      signal.addEventListener("abort", abort);
      if (signal.aborted) abort();
    }
    const { signal } = controller;
    const assertActive = () => {
      if (signal.aborted) throw new Error("The inventory request is no longer active.");
    };
    try {
      assertActive();
      if (!(await this.network.isOnline())) {
        assertActive();
        const data = await cached();
        assertActive();
        return { data, source: "device" };
      }
      let data: T;
      try {
        data = await fetch(signal);
      } catch (error) {
        assertActive();
        if (!(
          error instanceof NetworkError ||
          (error instanceof HTTPError && [502, 503, 504].includes(error.status))
        ))
          throw error;
        const data = await cached();
        assertActive();
        return { data, source: "device", fallbackError: error };
      }
      assertActive();
      await save(data);
      assertActive();
      return { data, source: "server" };
    } finally {
      for (const signal of signals) signal.removeEventListener("abort", abort);
    }
  }
}
