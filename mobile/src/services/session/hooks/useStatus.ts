import { useSessionState } from "./useSessionState";

export function useStatus() {
  return useSessionState((state) => state.status);
}
