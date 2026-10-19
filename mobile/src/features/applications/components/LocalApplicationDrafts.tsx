import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useNavigation } from "@react-navigation/native";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { Button, Text } from "@/components/ui";
import { useDiscardApplicationDraft, useLocalApplicationDrafts } from "../hooks";
import { ApplicationBadge } from "./ApplicationBadge";

export function LocalApplicationDrafts() {
  const navigation =
    useNavigation<AuthenticatedStackScreenProps<Routes.ApplicationForm>["navigation"]>();
  const query = useLocalApplicationDrafts();
  const discard = useDiscardApplicationDraft();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      {query.isPending && <ActivityIndicator accessibilityLabel="Loading local drafts" />}
      {query.isError && <Button title="Retry local drafts" onPress={() => void query.refetch()} />}
      {!!query.data?.length && (
        <>
          <Text variant="sectionHeading">Local drafts</Text>
          <Text color="textSecondary">
            These drafts are separate from server applications and are not included in their totals
            or filters.
          </Text>
        </>
      )}
      {query.data?.map((draft) => (
        <View key={draft.applicationId} style={styles.card}>
          <ApplicationBadge
            title={draft.lifecycle === "LocalOnly" ? "Local draft" : "Creation pending"}
          />
          <Text fontFamily="semibold">
            {draft.input.applicantInformation.name || "Unfinished application"}
          </Text>
          <Text color="textSecondary">Unit ID: {draft.unitId}</Text>
          <View style={styles.actions}>
            <Button
              title="Edit"
              variant="secondary"
              onPress={() =>
                navigation.navigate(Routes.ApplicationForm, { applicationId: draft.applicationId })
              }
            />
            <Button title="Delete" onPress={() => setSelected(draft.applicationId)} />
          </View>
        </View>
      ))}
      {selected && (
        <ConfirmationBottomSheet
          title="Discard local draft?"
          message="This discards the local draft and cancels only unsent creation work. If creation has already been sent, it must be reconciled first."
          confirmTitle="Discard draft"
          successMessage="Local draft discarded."
          onClose={() => setSelected(null)}
          onConfirm={async () => {
            await discard.mutateAsync({ id: selected, confirmed: true });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.md },
  card: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
}));
