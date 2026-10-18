import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OperationResult, JournalResponse } from "@/features/operations/types";
import { propertyKeys } from "@/features/properties/queryKeys";
import { unitKeys } from "@/features/units/queryKeys";
import { inventoryKeys } from "../queryKeys";

export function useInventoryMutation<TInput, TResponse extends JournalResponse>(
  mutationFn: (input: TInput) => Promise<OperationResult<TResponse>>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: async (result) => {
      if (result.status !== "Accepted") return;
      await Promise.all([
        client.invalidateQueries({ queryKey: propertyKeys.all }),
        client.invalidateQueries({ queryKey: unitKeys.all }),
        client.invalidateQueries({ queryKey: inventoryKeys.all }),
      ]);
    },
  });
}
