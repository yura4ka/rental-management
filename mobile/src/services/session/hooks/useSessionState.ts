import { useStore } from "zustand";
import type { SessionState } from "../session";
import { useSession } from "./useSession";

export function useSessionState<T>(selector: (state: SessionState) => T): T {
  return useStore(useSession().store, selector);
}
