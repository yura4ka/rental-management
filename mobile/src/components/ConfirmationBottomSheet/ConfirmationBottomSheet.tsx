import { useEffect, useRef, useState } from "react";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { toast } from "@/app/toast";
import { BottomSheet } from "@/components/BottomSheet";
import { Button, Text } from "@/components/ui";
import type { OperationResult } from "@/features/operations/types";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";

export function ConfirmationBottomSheet({
  title,
  message,
  confirmTitle = "Archive",
  successMessage = "Archived on server.",
  pendingMessage = "Pending sync. The archive has not been confirmed by the server.",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmTitle?: string;
  successMessage?: string;
  pendingMessage?: string;
  onConfirm: () => Promise<OperationResult | void>;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void sheet.current?.present();
  }, []);

  const confirm = async () => {
    if (busy || pending) return;
    setBusy(true);
    setError("");
    try {
      const result = await onConfirm();
      if (!result || result.status === "Accepted") {
        toast.success(successMessage);
        await sheet.current?.dismiss();
      } else setPending(true);
    } catch (error) {
      setError(getOperationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet.Root ref={sheet}>
      <BottomSheet.Content dismissible={!busy} onDidDismiss={onClose}>
        <BottomSheet.Header title={title} noCloseButton={busy} />
        <BottomSheet.Body>
          <Text>{message}</Text>
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          {pending && <Text accessibilityLiveRegion="polite">{pendingMessage}</Text>}
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button
            title={pending ? "Close" : "Cancel"}
            variant="secondary"
            disabled={busy}
            onPress={() => void sheet.current?.dismiss()}
          />
          {!pending && (
            <Button
              title={confirmTitle}
              disabled={busy}
              isLoadingLeft={busy}
              onPress={() => void confirm()}
            />
          )}
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}
