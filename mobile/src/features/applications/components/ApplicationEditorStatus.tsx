import { Button, Text } from "@/components/ui";
import type { OperationListItem } from "@/features/operations/types";
import { useSyncApplications } from "../hooks";

export function ApplicationEditorStatus({
  operations,
  locked,
  disabled,
  onRefresh,
  savedToServer,
}: {
  operations: OperationListItem[];
  locked: boolean;
  disabled: boolean;
  onRefresh: () => Promise<void>;
  savedToServer: boolean;
}) {
  const sync = useSyncApplications();
  return (
    <>
      {!operations.length && (
        <Text color="textSecondary">
          {savedToServer
            ? "Saved to server."
            : "On device — unfinished input is saved locally. Continue saves a valid section."}
        </Text>
      )}
      {locked && (
        <Text accessibilityRole="alert">
          Editing is unavailable. Resolve pending actions or refresh application status.
        </Text>
      )}
      {locked && (
        <Button
          title="Refresh application status"
          variant="secondary"
          disabled={disabled}
          onPress={() => void onRefresh()}
        />
      )}
      {operations.map((operation) => (
        <Text key={operation.id} accessibilityLiveRegion="polite">
          {operation.command}: {operation.state}.{" "}
          {operation.errorMessage ?? "Not yet confirmed by the server."}
          {operation.blockedByOperationId
            ? " Blocked by an earlier operation."
            : operation.waitingOnOperationId
              ? " Waiting for an earlier operation."
              : ""}
        </Text>
      ))}
      {!!operations.length && (
        <Button
          title="Sync pending saves"
          variant="secondary"
          disabled={disabled || sync.isPending}
          isLoadingLeft={sync.isPending}
          onPress={() => sync.mutate()}
        />
      )}
      {sync.isError && (
        <Text accessibilityRole="alert">Could not sync. Try again when connected.</Text>
      )}
    </>
  );
}
