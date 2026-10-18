import { useRef, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { toast } from "sonner-native";
import { Button, Text } from "@/components/ui";
import {
  availableApplicationActions,
  reviewActions,
  type ReviewAction,
} from "@/features/applications/presentation";
import type { ApplicationDto } from "@/features/applications/types";
import { useProperty } from "@/features/properties/hooks";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import {
  useStartReview,
  useReleaseApplication,
  useReturnApplication,
  useDenyApplication,
  useApproveApplication,
} from "../hooks";
import { ReviewCommentSheet } from "./ReviewCommentSheet";

export function ManagerApplicationActions({
  application,
  locked,
}: {
  application: ApplicationDto;
  locked: boolean;
}) {
  const property = useProperty(application.propertyId);
  const start = useStartReview();
  const release = useReleaseApplication();
  const returnApplication = useReturnApplication();
  const deny = useDenyApplication();
  const approve = useApproveApplication();
  const [sheet, setSheet] = useState<{ action: ReviewAction; application: ApplicationDto } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const actions = availableApplicationActions(
    application.status,
    false,
    !!property.data?.data,
    locked,
  );

  const perform = (action: ReviewAction, snapshot: ApplicationDto, comment = "") => {
    const input = { id: snapshot.id, expectedVersion: snapshot.version };
    switch (action) {
      case "startReview":
        return start.mutateAsync({ input });
      case "release":
        return release.mutateAsync({ input });
      case "return":
        return returnApplication.mutateAsync({ input: { ...input, comment } });
      case "deny":
        return deny.mutateAsync({ input: { ...input, comment } });
      case "approve":
        return approve.mutateAsync({ input: { ...input, comment: comment || null } });
    }
  };

  const press = async (action: ReviewAction) => {
    if (busyRef.current || locked || sheet) return;
    if (reviewActions[action].comment !== "none") {
      setSheet({ action, application });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await perform(action, application);
      if (result.status === "Accepted") toast.success("Application updated.");
      else toast.info("Pending. The action has not been confirmed by the server.");
    } catch (error) {
      setError(getOperationErrorMessage(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        {actions.review.map((action) => (
          <Button
            key={action}
            title={reviewActions[action].title}
            disabled={busy || sheet !== null}
            onPress={() => void press(action)}
          />
        ))}
      </View>
      {property.isError && (
        <Button
          title="Check review permissions again"
          variant="textPrimary"
          onPress={() => void property.refetch()}
        />
      )}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {sheet && (
        <ReviewCommentSheet
          action={sheet.action}
          onClose={() => setSheet(null)}
          onConfirm={(comment) => perform(sheet.action, sheet.application, comment)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
}));
