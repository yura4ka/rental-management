import { AppState } from "react-native";
import { focusManager, onlineManager, type QueryClient } from "@tanstack/react-query";
import { network } from "@/services/network";

export function setupQueryClientListeners(queryClient: QueryClient): () => void {
  let active = true;

  const focusSubscription = AppState.addEventListener("change", (state) => {
    focusManager.setFocused(state === "active");
  });
  focusManager.setFocused(AppState.currentState === "active");

  let previousOnline = network.isInitialized ? network.getSnapshot() : undefined;
  onlineManager.setOnline(network.getSnapshot());

  const unsubscribe = network.subscribe(() => {
    const online = network.getSnapshot();
    onlineManager.setOnline(online);
    const changed = previousOnline !== undefined && previousOnline !== online;
    previousOnline = online;
    if (changed) {
      queryClient.cancelQueries().then(() => {
        if (active) return queryClient.invalidateQueries();
      });
    }
  });

  const stopNetwork = network.start();

  return () => {
    active = false;
    unsubscribe();
    stopNetwork();
    focusSubscription?.remove();
    focusManager.setFocused(undefined);
  };
}
