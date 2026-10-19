import { useCallback, useRef, useState } from "react";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import { useSaveApplicationDraft } from "./hooks";
import type { ApplicationEditorInput, ApplicationStep } from "./forms";

/** Serialize writes so an older keystroke cannot overwrite a newer local draft. */
export function useApplicationDraftPersistence(id: string) {
  const mutation = useSaveApplicationDraft();
  const save = mutation.mutateAsync;
  const tail = useRef<Promise<void>>(Promise.resolve());
  const [error, setError] = useState("");

  const persist = useCallback(
    (input: ApplicationEditorInput, step?: ApplicationStep) => {
      const snapshot = JSON.parse(JSON.stringify(input)) as ApplicationEditorInput;
      const task = tail.current.then(() => save({ id, input: snapshot, step }));
      // Observe failures for autosaves, but return the rejecting task to explicit saves.
      tail.current = task.catch(() => {});
      void task.then(
        () => setError(""),
        (cause) => setError(getOperationErrorMessage(cause)),
      );
      return task;
    },
    [id, save],
  );

  return { persist, error };
}
