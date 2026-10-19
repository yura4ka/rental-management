import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { useApplicationMutation } from "@/features/applications/useApplicationMutation";
import type { ApplicationMutationOptions } from "@/features/applications/applicationsService";
import type { ApplicationReviewCommands } from "./operations/types";
import { applicationReviewKeys } from "./queryKeys";

type Variables<K extends keyof ApplicationReviewCommands> = {
  input: ApplicationReviewCommands[K]["input"];
} & ApplicationMutationOptions;

export function useStartReview() {
  const session = useSession();
  return useApplicationMutation(({ input, ...options }: Variables<"StartReview">) =>
    session.getService("applicationReviews").startReview(input, options),
  );
}

export function useReleaseApplication() {
  const session = useSession();
  return useApplicationMutation(({ input, ...options }: Variables<"ReleaseApplication">) =>
    session.getService("applicationReviews").releaseApplication(input, options),
  );
}

export function useReturnApplication() {
  const session = useSession();
  return useApplicationMutation(({ input, ...options }: Variables<"ReturnApplication">) =>
    session.getService("applicationReviews").returnApplication(input, options),
  );
}

export function useDenyApplication() {
  const session = useSession();
  return useApplicationMutation(({ input, ...options }: Variables<"DenyApplication">) =>
    session.getService("applicationReviews").denyApplication(input, options),
  );
}

export function useApproveApplication() {
  const session = useSession();
  return useApplicationMutation(({ input, ...options }: Variables<"ApproveApplication">) =>
    session.getService("applicationReviews").approveApplication(input, options),
  );
}

export function useSaveManagerNote() {
  const session = useSession();
  return useApplicationMutation(({ input, ...options }: Variables<"SaveManagerNote">) =>
    session.getService("applicationReviews").saveManagerNote(input, options),
  );
}

export function useRejectAllApplications() {
  const session = useSession();
  return useApplicationMutation(
    ({
      input,
      confirmed,
      ...options
    }: Variables<"RejectAllApplications"> & { confirmed: boolean }) => {
      if (!confirmed)
        return Promise.reject(new Error("Confirm rejecting all open applications for this unit."));
      return session.getService("applicationReviews").rejectAllApplications(input, options);
    },
  );
}

export function useManagerNoteDraft(id: string) {
  const session = useSession();
  return useQuery({
    queryKey: applicationReviewKeys.noteDraft(id),
    queryFn: () => session.getService("applicationReviews").getNoteDraft(id),
  });
}

export function useSaveManagerNoteDraft(id: string) {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, expectedVersion }: { body: string; expectedVersion: string | null }) =>
      session.getService("applicationReviews").saveNoteDraft(id, body, expectedVersion),
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: applicationReviewKeys.noteDraft(id) }),
  });
}
