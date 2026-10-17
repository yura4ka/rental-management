import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always",
        retry: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: "always",
        retry: false,
      },
    },
  });
}
