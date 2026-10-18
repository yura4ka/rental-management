import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { toast } from "sonner-native";
import { useAppForm } from "@/app/form";
import { Button, Text } from "@/components/ui";
import { managerNoteFormSchema } from "@/features/applications/presentation";
import type { ManagerNoteDto } from "@/features/applications/types";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import { useManagerNoteDraft, useSaveManagerNoteDraft, useSaveManagerNote } from "../hooks";

export function ManagerNoteField({
  id,
  note,
  locked,
}: {
  id: string;
  note: ManagerNoteDto | null;
  locked: boolean;
}) {
  const draft = useManagerNoteDraft(id);
  if (draft.isPending) return <ActivityIndicator accessibilityLabel="Loading private note" />;
  if (draft.isError)
    return <Button title="Retry private note" onPress={() => void draft.refetch()} />;
  return (
    <NoteEditor
      key={id}
      id={id}
      note={note}
      locked={locked}
      initial={draft.data ?? { body: note?.body ?? "", expectedVersion: note?.version ?? null }}
    />
  );
}

function NoteEditor({
  id,
  note,
  locked,
  initial,
}: {
  id: string;
  note: ManagerNoteDto | null;
  locked: boolean;
  initial: { body: string; expectedVersion: string | null };
}) {
  const saveDraft = useSaveManagerNoteDraft(id);
  const save = useSaveManagerNote();
  const version = useRef(initial.expectedVersion);
  const savedBody = useRef(note?.body ?? "");
  const [error, setError] = useState("");
  const reload = () => {
    version.current = note?.version ?? null;
    savedBody.current = note?.body ?? "";
    form.reset({ body: savedBody.current });
    setError("");
    void saveDraft
      .mutateAsync({ body: savedBody.current, expectedVersion: version.current })
      .catch(() => {
        setError("Could not update the local note draft.");
      });
  };
  const form = useAppForm({
    defaultValues: { body: initial.body },
    validators: { onChange: managerNoteFormSchema, onSubmit: managerNoteFormSchema },
    onSubmit: async ({ value }) => {
      if (locked || value.body === savedBody.current) return;
      setError("");
      try {
        const input = managerNoteFormSchema.parse(value);
        await saveDraft.mutateAsync({ body: input.body, expectedVersion: version.current });
        const result = await save.mutateAsync({
          input: { id, body: input.body, expectedVersion: version.current },
        });
        if (result.status === "Accepted") {
          version.current = result.data.version;
          savedBody.current = input.body;
          toast.success("Private note saved.");
        } else toast.info("Pending. The private note has not been confirmed by the server.");
      } catch (error) {
        setError(getOperationErrorMessage(error));
      }
    },
  });

  return (
    <form.AppForm>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(busy) => (
          <View>
            <form.AppField name="body">
              {(field) => (
                <field.FormInput
                  label="Private note"
                  description="Only you can see this note. Saved when editing ends."
                  multiline
                  maxLength={2000}
                  disabled={busy || locked}
                  onEndEditing={() => void form.handleSubmit()}
                />
              )}
            </form.AppField>
            {!!error && (
              <>
                <Text accessibilityRole="alert">{error}</Text>
                <form.SubmitButton title="Retry saving note" disabled={locked} />
              </>
            )}
            {!locked && (!!error || version.current !== (note?.version ?? null)) && (
              <Button
                title="Reload saved note and discard changes"
                variant="textPrimary"
                disabled={busy}
                onPress={reload}
              />
            )}
            {locked && (
              <Text accessibilityLiveRegion="polite">
                The note has an unresolved operation. Server save is not confirmed.
              </Text>
            )}
          </View>
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}
