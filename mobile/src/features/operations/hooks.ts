import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/services/session";

export const operationKeys = { all: ["operations"] as const };

export function useOperations(focused: boolean) {
  const session = useSession();
  return useQuery({
    queryKey: operationKeys.all,
    queryFn: () => session.getService("operations").getAll(),
    enabled: focused,
    refetchInterval: focused ? 1500 : false,
  });
}

export function useProcessOperations() {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => session.getService("operations").processPending(),
    retry: false,
    onSettled: async () => {
      if (session.status === "authenticated") await client.invalidateQueries();
    },
  });
}

export function useDismissOperation() {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => session.getService("operations").dismiss(id),
    retry: false,
    onSettled: async () => {
      if (session.status === "authenticated") await client.invalidateQueries();
    },
  });
}
