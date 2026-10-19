import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OperationResult, JournalResponse } from "@/features/operations/types";
import { inventoryKeys } from "@/features/inventory/queryKeys";
import { unitKeys } from "@/features/units/queryKeys";
import { applicationReviewKeys } from "@/features/applicationReviews/queryKeys";
import { applicationKeys } from "./queryKeys";

export function useApplicationMutation<TInput, TResponse extends JournalResponse>(
  mutationFn: (input: TInput) => Promise<OperationResult<TResponse>>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    retry: false,
    onSettled: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: applicationKeys.all }),
        client.invalidateQueries({ queryKey: applicationKeys.operations() }),
        client.invalidateQueries({ queryKey: applicationReviewKeys.all }),
        ...(result?.status === "Accepted" &&
        result.data.affectedResources.some(
          (r) => r.resourceType === "Unit" || r.resourceType === "Lease",
        )
          ? [
              client.invalidateQueries({ queryKey: inventoryKeys.all }),
              client.invalidateQueries({ queryKey: unitKeys.all }),
            ]
          : []),
      ]);
    },
  });
}
