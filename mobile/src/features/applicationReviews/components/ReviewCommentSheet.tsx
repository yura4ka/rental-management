import { useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { toast } from "sonner-native";
import { useAppForm } from "@/app/form";
import { BottomSheet } from "@/components/BottomSheet";
import { Button, Text } from "@/components/ui";
import {
  reviewActions,
  reviewCommentFormSchema,
  type ReviewAction,
} from "@/features/applications/presentation";
import type { OperationResult } from "@/features/operations/types";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";

export function ReviewCommentSheet({
  action,
  onConfirm,
  onClose,
}: {
  action: ReviewAction;
  onConfirm: (comment: string) => Promise<OperationResult>;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const schema = reviewCommentFormSchema(reviewActions[action].comment === "required");
  const form = useAppForm({
    defaultValues: { comment: "" },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const result = await onConfirm(schema.parse(value).comment);
        if (result.status === "Accepted") {
          toast.success("Application updated.");
          await sheet.current?.dismiss();
        } else setPending(true);
      } catch (error) {
        setError(getOperationErrorMessage(error));
      }
    },
  });
  useEffect(() => {
    void sheet.current?.present();
  }, []);

  return (
    <form.AppForm>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(busy) => (
          <BottomSheet.Root ref={sheet}>
            <BottomSheet.Content scrollable dismissible={!busy} onDidDismiss={onClose}>
              <BottomSheet.Header
                title={`${reviewActions[action].title} application?`}
                noCloseButton={busy}
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                <BottomSheet.Body>
                  {action === "approve" && (
                    <Text>
                      Approval issues a twelve-month lease and cannot be undone. Other applications
                      remain unchanged.
                    </Text>
                  )}
                  <form.AppField name="comment">
                    {(field) => (
                      <field.FormInput
                        label={action === "approve" ? "Comment (optional)" : "Comment"}
                        multiline
                        maxLength={2000}
                        disabled={busy || pending}
                      />
                    )}
                  </form.AppField>
                  {!!error && <Text accessibilityRole="alert">{error}</Text>}
                  {pending && (
                    <Text accessibilityLiveRegion="polite">
                      Pending. This action has not been confirmed by the server.
                    </Text>
                  )}
                </BottomSheet.Body>
              </ScrollView>
              <BottomSheet.Footer>
                <Button
                  title={pending ? "Close" : "Cancel"}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void sheet.current?.dismiss()}
                />
                {!pending && <form.SubmitButton title={reviewActions[action].title} />}
              </BottomSheet.Footer>
            </BottomSheet.Content>
          </BottomSheet.Root>
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}
