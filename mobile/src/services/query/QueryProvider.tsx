import { useEffect, type PropsWithChildren } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { setupQueryClientListeners } from "./setupQueryClientListeners";

export function QueryProvider({ client, children }: PropsWithChildren<{ client: QueryClient }>) {
  useEffect(() => setupQueryClientListeners(client), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
