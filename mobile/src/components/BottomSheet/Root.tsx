import { useMemo, type ReactNode } from "react";
import { RootContext, type RootContextValue } from "./context";

export type BottomSheetRootProps = RootContextValue & {
  children: ReactNode;
};

export function Root({ ref, children }: BottomSheetRootProps) {
  const context = useMemo(() => ({ ref }), [ref]);

  return <RootContext.Provider value={context}>{children}</RootContext.Provider>;
}
