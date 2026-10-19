import { HTTPError, NetworkError } from "@/services/api";
import type { INetwork } from "@/services/network";
import type { InventoryRead } from "./inventoryService";

/** Keep transport fallback separate from persistence failures and authorization errors. */
export async function readInventory<T>(
  network: INetwork,
  sessionSignal: AbortSignal,
  querySignal: AbortSignal | undefined,
  fetch: (signal: AbortSignal) => Promise<T>,
  cached: () => Promise<T>,
  save: (data: T) => Promise<void>,
): Promise<InventoryRead<T>> {
  const controller = new AbortController();
  const signals = [sessionSignal, ...(querySignal ? [querySignal] : [])];
  const abort = () => controller.abort();
  const check = () => {
    if (controller.signal.aborted) throw new Error("The inventory request is no longer active.");
  };
  for (const signal of signals) {
    signal.addEventListener("abort", abort);
    if (signal.aborted) abort();
  }
  try {
    check();
    if (!(await network.isOnline())) {
      check();
      const data = await cached();
      check();
      return { data, source: "device" };
    }
    let data: T;
    try {
      data = await fetch(controller.signal);
    } catch (error) {
      check();
      if (!(
        error instanceof NetworkError ||
        (error instanceof HTTPError && [502, 503, 504].includes(error.status))
      ))
        throw error;
      const data = await cached();
      check();
      return { data, source: "device", fallbackError: error };
    }
    check();
    await save(data);
    check();
    return { data, source: "server" };
  } finally {
    for (const signal of signals) signal.removeEventListener("abort", abort);
  }
}
