import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import type { ApplicationsService, ApplicationMutationOptions } from "./applicationsService";
import type { ApplicationEditorInput, ApplicationStep } from "./forms";
import type { ApplicationCommands } from "./operations/types";
import type { GetApplicationsRequestParams } from "./types";
import { applicationKeys } from "./queryKeys";
import { useApplicationMutation } from "./useApplicationMutation";

export function useApplications(params: Omit<GetApplicationsRequestParams, "page"> = {}) {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: applicationKeys.list(params),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      session.getService("applications").getApplications({ ...params, page: pageParam }, signal),
    getNextPageParam: ({ data }) =>
      data.page * data.pageSize < data.total ? data.page + 1 : undefined,
  });
}

export function useApplication(id: string, enabled = true) {
  const session = useSession();
  return useQuery({
    queryKey: applicationKeys.detail(id),
    enabled,
    queryFn: ({ signal }) => session.getService("applications").getApplication(id, signal),
  });
}

export function useApplicationEditor(id: string) {
  const session = useSession();
  return useQuery({
    queryKey: applicationKeys.editor(id),
    queryFn: () => session.getService("applications").getEditor(id),
  });
}

export function useInitializeApplicationEditor(params: {
  applicationId?: string;
  unitId?: string;
}) {
  const session = useSession();
  return useQuery({
    queryKey: ["applicationForm", params],
    queryFn: () => {
      const service = session.getService("applications");
      if (params.applicationId) return service.openEditor(params.applicationId);
      if (params.unitId) return service.startDraft(params.unitId);
      throw new Error("An application or unit is required.");
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
}

export function useApplicationSummary(id: string) {
  const session = useSession();
  return useQuery({
    queryKey: applicationKeys.summary(id),
    queryFn: () => session.getService("applications").getSummary(id),
  });
}

export function useLocalApplicationDrafts() {
  const session = useSession();
  return useQuery({
    queryKey: applicationKeys.localDrafts(),
    queryFn: () => session.getService("applications").getLocalDrafts(),
  });
}

function useLocalEditorMutation<T, TResult>(mutationFn: (input: T) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "applications" &&
            ["editor", "summary", "localDrafts"].includes(String(query.queryKey[1])),
        }),
        client.invalidateQueries({ queryKey: applicationKeys.operations() }),
      ]);
    },
  });
}

export function useStartApplicationDraft() {
  const session = useSession();
  return useLocalEditorMutation((unitId: string) =>
    session.getService("applications").startDraft(unitId),
  );
}

export function useOpenApplicationEditor() {
  const session = useSession();
  return useLocalEditorMutation((id: string) => session.getService("applications").openEditor(id));
}

export function useSaveApplicationDraft() {
  const session = useSession();
  return useLocalEditorMutation(
    ({ id, input, step }: { id: string; input: ApplicationEditorInput; step?: ApplicationStep }) =>
      session.getService("applications").saveDraft(id, input, step),
  );
}

export function useDiscardApplicationDraft() {
  const session = useSession();
  return useLocalEditorMutation(({ id, confirmed }: { id: string; confirmed: boolean }) =>
    session.getService("applications").discardLocalDraft(id, confirmed),
  );
}

export function useCloseApplicationEditor() {
  const session = useSession();
  return useLocalEditorMutation(({ id, confirmed }: { id: string; confirmed: boolean }) =>
    session.getService("applications").closeEditor(id, confirmed),
  );
}

export function useCopyProfileSection() {
  const session = useSession();
  return useLocalEditorMutation((args: Parameters<ApplicationsService["copyProfileSection"]>) =>
    session.getService("applications").copyProfileSection(...args),
  );
}

type ContinueVariables = { id: string } & ApplicationMutationOptions;

export function useContinueApplicantInformation() {
  const session = useSession();
  return useApplicationMutation(({ id, ...options }: ContinueVariables) =>
    session.getService("applications").continueApplicantInformation(id, options),
  );
}

export function useContinueResidenceHistory() {
  const session = useSession();
  return useApplicationMutation(({ id, ...options }: ContinueVariables) =>
    session.getService("applications").continueResidenceHistory(id, options),
  );
}

export function useSubmitApplication() {
  const session = useSession();
  return useApplicationMutation(
    ({
      input,
      ...options
    }: { input: ApplicationCommands["SubmitApplication"]["input"] } & ApplicationMutationOptions) =>
      session.getService("applications").submitApplication(input, options),
  );
}

export function useWithdrawApplication() {
  const session = useSession();
  return useApplicationMutation(
    ({
      input,
      confirmed,
      ...options
    }: {
      input: ApplicationCommands["WithdrawApplication"]["input"];
      confirmed: boolean;
    } & ApplicationMutationOptions) => {
      if (!confirmed) return Promise.reject(new Error("Confirm withdrawing the application."));
      return session.getService("applications").withdrawApplication(input, options);
    },
  );
}

export function useApplicationOperations() {
  const session = useSession();
  return useQuery({
    queryKey: applicationKeys.operations(),
    queryFn: async () =>
      (await session.getService("operations").getAll()).filter(
        (operation) =>
          operation.resourceType === "Application" ||
          operation.resourceType === "ManagerNote" ||
          operation.command === "RejectAllApplications",
      ),
  });
}

/** Explicit processing pass; no background/reconnect worker is installed by this feature. */
export function useSyncApplications() {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => session.getService("operations").processPending(),
    retry: false,
    onSettled: async () => {
      await client.invalidateQueries();
    },
  });
}
