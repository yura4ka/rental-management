import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import type { ApplicantProfileService } from "../applicantProfileService";
import { applicantProfileKeys } from "../queryKeys";

export type UpdateApplicantInformationVariables = {
  input: Parameters<ApplicantProfileService["updateApplicantInformation"]>[0];
  replacesOperationId?: string;
};

export function useUpdateApplicantInformation() {
  const queryClient = useQueryClient();
  const session = useSession();

  return useMutation({
    mutationKey: applicantProfileKeys.updateApplicantInformation(),
    mutationFn: ({ input, replacesOperationId }: UpdateApplicantInformationVariables) =>
      session
        .getService("applicantProfile")
        .updateApplicantInformation(
          input,
          replacesOperationId ? { replacesOperationId } : undefined,
        ),
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
