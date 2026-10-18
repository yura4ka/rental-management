import { createContext, useContext, type RefObject } from "react";
import type { TrueSheet } from "@lodev09/react-native-true-sheet";

export type RootContextValue = {
  ref: RefObject<TrueSheet | null>;
};

export const RootContext = createContext<RootContextValue | null>(null);

export function useRootContext() {
  const context = useContext(RootContext);

  if (!context) {
    throw new Error("BottomSheet components must be used within BottomSheet.Root.");
  }

  return context;
}
