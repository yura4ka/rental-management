import { useSyncExternalStore } from "react";
import { network } from "@/services/network/network";
import type { ApplicationEditor } from "./applicationEditorRepository";
import type { ApplicationStep } from "./forms";
import {
  useApplication,
  useApplicationEditor,
  useApplicationOperations,
  useApplicationSummary,
} from "./hooks";
import { applicationActionOperations } from "./presentation";

export function useApplicationFormState(initialEditor: ApplicationEditor, step: ApplicationStep) {
  const id = initialEditor.applicationId;
  const editor = useApplicationEditor(id);
  const serverLinked = (editor.data ?? initialEditor).lifecycle === "ServerLinked";
  const application = useApplication(id, serverLinked);
  const summary = useApplicationSummary(id);
  const operations = useApplicationOperations();
  const online = useSyncExternalStore(network.subscribe, network.getSnapshot);
  const pending = applicationActionOperations(
    { id, unitId: initialEditor.unitId },
    operations.data ?? [],
  );
  const detail = application.data?.data;
  const serverLocked =
    serverLinked &&
    (!detail || detail.isOutdated || !["Draft", "Returned"].includes(detail.application.status));
  const locked =
    serverLocked ||
    operations.isPending ||
    operations.isError ||
    pending.some((operation) =>
      [
        "SubmitApplication",
        "WithdrawApplication",
        "ReturnApplication",
        "DenyApplication",
        "ApproveApplication",
        "ReleaseApplication",
        "RejectAllApplications",
      ].includes(operation.command),
    );
  const rejected = pending.findLast(
    (operation) =>
      operation.state === "Rejected" &&
      (step === "ApplicantInformation"
        ? ["CreateApplication", "UpdateApplicationInformation"].includes(operation.command)
        : step === "ResidenceHistory" && operation.command === "UpdateApplicationResidences"),
  );
  const summaryBlocked =
    !summary.data ||
    summary.isFetching ||
    summary.data.hasUnfinishedEdits ||
    !summary.data.snapshots.ApplicantInformation ||
    !summary.data.snapshots.ResidenceHistory ||
    (online && !summary.data.sectionsAccepted);
  const refresh = async () => {
    await Promise.all([
      editor.refetch(),
      summary.refetch(),
      operations.refetch(),
      ...(serverLinked ? [application.refetch()] : []),
    ]);
  };

  return { editor, summary, pending, locked, rejected, summaryBlocked, refresh };
}
