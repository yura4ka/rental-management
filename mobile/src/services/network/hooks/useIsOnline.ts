import { useSyncExternalStore } from "react";
import { network } from "../network";

export function useIsOnline(): boolean {
  return useSyncExternalStore(network.subscribe, network.getSnapshot, network.getSnapshot);
}
