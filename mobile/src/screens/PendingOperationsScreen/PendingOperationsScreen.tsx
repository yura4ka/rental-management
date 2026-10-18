import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useIsFocused } from "@react-navigation/native";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { FlatListLayout } from "@/components/layout";
import { Button, Text } from "@/components/ui";
import {
  useDismissOperation,
  useOperations,
  useProcessOperations,
} from "@/features/operations/hooks";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import {
  canClearOperation,
  operationLabel,
  operationStatus,
  operationTarget,
} from "@/features/operations/presentation";
import type { OperationListItem } from "@/features/operations/types";

export function PendingOperationsScreen({
  navigation,
}: AuthenticatedStackScreenProps<Routes.PendingOperations>) {
  const query = useOperations(useIsFocused());
  const sync = useProcessOperations();
  const dismiss = useDismissOperation();
  const [clearing, setClearing] = useState<OperationListItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = sync.isPending || dismiss.isPending || clearing !== null;
  const actionError = sync.error ?? dismiss.error;

  const open = (operation: OperationListItem) => {
    const target = operationTarget(operation);
    if (!target) return;
    switch (target.screen) {
      case Routes.Profile:
        navigation.navigate(Routes.Profile);
        break;
      case Routes.PropertyDetails:
        navigation.navigate(Routes.PropertyDetails, { propertyId: target.propertyId });
        break;
      case Routes.ApplicationForm:
        navigation.navigate(Routes.ApplicationForm, { applicationId: target.applicationId });
        break;
      case Routes.ApplicationDetails:
        navigation.navigate(Routes.ApplicationDetails, { applicationId: target.applicationId });
        break;
    }
  };

  return (
    <>
      <FlatListLayout
        edges={["left", "right", "bottom"]}
        data={query.data?.filter((item) => !item.dismissedAt) ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void query.refetch().finally(() => setRefreshing(false));
        }}
        ListHeaderComponent={
          <View style={styles.feedback}>
            <Text color="textSecondary">Pending work and retained results on this device.</Text>
            <Button
              title="Sync pending operations"
              disabled={busy}
              isLoadingLeft={sync.isPending}
              onPress={() => sync.mutate()}
            />
            {query.isError && (
              <>
                <Text accessibilityRole="alert">Could not load operations.</Text>
                <Button title="Retry" variant="textPrimary" onPress={() => void query.refetch()} />
              </>
            )}
            {!!actionError && (
              <Text accessibilityRole="alert">{getOperationErrorMessage(actionError)}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator accessibilityLabel="Loading pending operations" />
          ) : query.isError ? null : (
            <Text color="textSecondary">No pending operations or retained results.</Text>
          )
        }
        renderItem={({ item }) => {
          const failed =
            item.state === "Rejected" ||
            !!item.errorMessage ||
            !!item.errorCode ||
            !!item.replayBlockCode ||
            !!item.blockedByOperationId;
          return (
            <View style={styles.card}>
              <Text fontFamily="semibold">{operationLabel(item.command)}</Text>
              <Text>
                {operationStatus(item)} ({item.state})
              </Text>
              <Text color="textSecondary">
                {item.resourceType}: {item.resourceId}
              </Text>
              {!!item.blockedByOperationId ? (
                <Text>Blocked by operation {item.blockedByOperationId}.</Text>
              ) : (
                !!item.waitingOnOperationId && (
                  <Text>Waiting for operation {item.waitingOnOperationId}.</Text>
                )
              )}
              {!!item.replayBlockCode && (
                <Text>Sync blocked: {operationLabel(item.replayBlockCode)}.</Text>
              )}
              {!!item.nextAttemptAt && (
                <Text>Next retry: {new Date(item.nextAttemptAt).toLocaleString()}</Text>
              )}
              {!!(item.errorMessage || item.errorCode) && (
                <Text accessibilityRole="alert">{item.errorMessage ?? item.errorCode}</Text>
              )}
              {failed && operationTarget(item) && (
                <Button
                  title="Open related item"
                  variant="textPrimary"
                  disabled={busy}
                  onPress={() => open(item)}
                />
              )}
              {canClearOperation(item) && (
                <Button
                  title={item.state === "Rejected" ? "Clear failed operation" : "Cancel operation"}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setClearing(item)}
                />
              )}
              {(item.state === "Accepted" || item.state === "Cancelled") && (
                <Button
                  title="Discard from list"
                  variant="textPrimary"
                  disabled={busy}
                  onPress={() => dismiss.mutate(item.id)}
                />
              )}
              {item.state === "Dispatched" && (
                <Text color="textSecondary">
                  This request may have reached the server and cannot be cancelled. Sync to
                  reconcile its outcome.
                </Text>
              )}
            </View>
          );
        }}
      />
      {clearing && (
        <ConfirmationBottomSheet
          title={clearing.state === "Rejected" ? "Clear failed operation?" : "Cancel operation?"}
          message="This also cancels unsent dependent operations. Local form input is preserved. Dispatched or accepted work cannot be cancelled."
          confirmTitle={clearing.state === "Rejected" ? "Clear operation" : "Cancel operation"}
          successMessage="Operation cleared. Local input preserved."
          onConfirm={() => dismiss.mutateAsync(clearing.id)}
          onClose={() => setClearing(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  feedback: {
    gap: theme.spacing.sm,
  },
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
}));
