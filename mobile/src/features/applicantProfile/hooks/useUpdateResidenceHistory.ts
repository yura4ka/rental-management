import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import type { ApplicantProfileService } from "../applicantProfileService";
import { applicantProfileKeys } from "../queryKeys";

export type UpdateResidenceHistoryVariables = {
  input: Parameters<ApplicantProfileService["updateResidenceHistory"]>[0];
  replacesOperationId?: string;
};

export function useUpdateResidenceHistory() {
  const queryClient = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationKey: applicantProfileKeys.updateResidenceHistory(),
    mutationFn: ({ input, replacesOperationId }: UpdateResidenceHistoryVariables) =>
      session
        .getService("applicantProfile")
        .updateResidenceHistory(input, replacesOperationId ? { replacesOperationId } : undefined),
    onSuccess: async (result) => {
      if (result.status === "Accepted") {
        await queryClient.invalidateQueries({
          queryKey: applicantProfileKeys.detail(),
          exact: true,
        });
      }
    },
  });
}
