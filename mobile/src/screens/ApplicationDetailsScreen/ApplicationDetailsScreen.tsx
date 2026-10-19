import { useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { StyleSheet } from "react-native-unistyles";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { LabelValue } from "@/components/LabelValue";
import { Button, Text } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import { ManagerApplicationActions } from "@/features/applicationReviews/components/ManagerApplicationActions";
import { ManagerNoteField } from "@/features/applicationReviews/components/ManagerNoteField";
import { ApplicationBadge } from "@/features/applications/components/ApplicationBadge";
import {
  useApplication,
  useApplicationOperations,
  useWithdrawApplication,
  useSyncApplications,
} from "@/features/applications/hooks";
import {
  applicationActionOperations,
  applicationDate,
  availableApplicationActions,
  statusLabel,
} from "@/features/applications/presentation";
import type { ApplicationDto } from "@/features/applications/types";
import { useSessionState } from "@/services/session";
import { ScrollViewLayout } from "@/components/layout";
import { Card } from "@/components";

export function ApplicationDetailsScreen({
  route,
  navigation,
}: AuthenticatedStackScreenProps<Routes.ApplicationDetails>) {
  const { applicationId } = route.params;
  const query = useApplication(applicationId);
  const operations = useApplicationOperations();
  const withdraw = useWithdrawApplication();
  const sync = useSyncApplications();
  const account = useSessionState((state) => state.account);
  const manager = account?.role === "PropertyManager";
  const [confirmation, setConfirmation] = useState<ApplicationDto | null>(null);
  const data = query.data?.data;

  if (!data)
    return (
      <View style={styles.content}>
        {query.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading application" />
        ) : (
          <>
            <Text>Application unavailable. Connect to download its details, or try again.</Text>
            <Button title="Retry" onPress={() => void query.refetch()} />
          </>
        )}
      </View>
    );

  const application = data.application;
  const actionOperations = applicationActionOperations(application, operations.data ?? []);
  const locked =
    operations.isPending || operations.isError || data.isOutdated || actionOperations.length > 0;
  const noteLocked =
    operations.isPending ||
    operations.isError ||
    (operations.data ?? []).some(
      (operation) =>
        operation.resourceType === "ManagerNote" &&
        operation.resourceId === applicationId &&
        !operation.dismissedAt &&
        ["Queued", "Dispatched", "Rejected"].includes(operation.state),
    );
  const actions = availableApplicationActions(
    application.status,
    !manager && account?.id === application.applicantId,
    false,
    locked,
  );
  const info = data.applicantInformation;
  const refresh = () => {
    void query.refetch();
    void operations.refetch();
  };

  return (
    <KeyboardAvoidingView style={styles.screen}>
      <ScrollViewLayout
        edges={["bottom", "left", "right"]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={refresh} />}
      >
        <View style={styles.badges}>
          <ApplicationBadge status={application.status} />
          {application.isArchived && <ApplicationBadge title="Archived inventory" />}
          {actionOperations.length > 0 && <ApplicationBadge title="Unresolved action" />}
          {data.isOutdated && <ApplicationBadge title="Outdated details" />}
        </View>
        {query.data?.source === "device" && (
          <Text color="textSecondary">Showing downloaded application details.</Text>
        )}
        {(query.isError || query.data?.fallbackError != null || data.isOutdated) && (
          <>
            <Text>Details may be outdated. Refresh before taking an action.</Text>
            <Button title="Refresh application" variant="textPrimary" onPress={refresh} />
          </>
        )}
        {actionOperations.map((operation) => (
          <Text key={operation.id} accessibilityLiveRegion="polite">
            {operation.command}: {operation.state}.{" "}
            {operation.errorMessage ?? "Not yet confirmed by the server."}
          </Text>
        ))}
        {operations.isError && (
          <Button title="Retry action status" onPress={() => void operations.refetch()} />
        )}
        {(actionOperations.length > 0 || noteLocked) &&
          !operations.isPending &&
          !operations.isError && (
            <>
              <Button
                title="Sync pending actions"
                variant="secondary"
                isLoadingLeft={sync.isPending}
                onPress={() => sync.mutate()}
              />
              {sync.isError && (
                <Text accessibilityRole="alert">
                  Could not sync pending actions. Try again when connected.
                </Text>
              )}
            </>
          )}
        {manager && (
          <ManagerApplicationActions
            key={application.id}
            application={application}
            locked={locked}
          />
        )}
        {(actions.edit || actions.withdraw) && (
          <View style={styles.badges}>
            {actions.edit && (
              <Button
                size="sm"
                title="Edit"
                variant="secondary"
                onPress={() => navigation.navigate(Routes.ApplicationForm, { applicationId })}
              />
            )}
            {actions.withdraw && (
              <Button title="Delete" size="sm" onPress={() => setConfirmation(application)} />
            )}
          </View>
        )}
        <Card.Root>
          <Card.Header title="Application" border={true} />
          <Card.Body>
            <LabelValue
              items={[
                { label: "Application ID", value: application.id },
                { label: "Property", value: getAddressDisplayName(application.propertyAddress) },
                { label: "Unit", value: application.unitNumber },
                { label: "Created", value: applicationDate(application.createdAt) },
                { label: "Status changed", value: applicationDate(application.statusChangedAt) },
              ]}
            />
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Header title="Applicant information" border={true} />
          <Card.Body>
            <LabelValue
              items={[
                { label: "Name", value: info.name },
                { label: "Phone", value: info.phone },
                { label: "Email", value: info.contactEmail },
                { label: "Current address", value: getAddressDisplayName(info.currentAddress) },
                {
                  label: "Information saved",
                  value: applicationDate(data.applicantInformationSavedAt),
                },
              ]}
            />
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Header title="Residence history" border={true} />
          <Card.Body>
            {!data.residenceHistorySavedAt ? (
              <Text color="textSecondary">Residence history has not been saved.</Text>
            ) : (
              !data.residenceHistory.length && (
                <Text color="textSecondary">No previous residences.</Text>
              )
            )}
            {data.residenceHistory.map((residence) => (
              <LabelValue
                key={residence.position}
                items={[
                  { label: "Address", value: getAddressDisplayName(residence.address) },
                  { label: "Landlord", value: residence.landlordName },
                  { label: "Landlord phone", value: residence.landlordPhone },
                  { label: "Move-in date", value: applicationDate(residence.moveInDate, true) },
                  { label: "Move-out date", value: applicationDate(residence.moveOutDate, true) },
                ]}
              />
            ))}
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Header title="Review history" border={true} />
          <Card.Body>
            {!data.history.length && <Text color="textSecondary">No history yet.</Text>}
            {data.history.map((entry) => (
              <LabelValue
                key={entry.id}
                items={[
                  { label: "Action", value: entry.action },
                  {
                    label: "Previous status",
                    value: entry.fromStatus ? statusLabel(entry.fromStatus) : "None",
                  },
                  { label: "New status", value: statusLabel(entry.toStatus) },
                  { label: "Date", value: new Date(entry.occurredAt).toLocaleString() },
                  { label: "Comment", value: entry.comment },
                ]}
              />
            ))}
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Header title="Lease" border={true} />
          <Card.Body>
            {data.lease ? (
              <LabelValue
                items={[
                  { label: "Start date", value: applicationDate(data.lease.startDate, true) },
                  {
                    label: "End date (exclusive)",
                    value: applicationDate(data.lease.endDateExclusive, true),
                  },
                  { label: "Approved", value: applicationDate(data.lease.approvedAt) },
                ]}
              />
            ) : (
              <Text color="textSecondary">No lease issued.</Text>
            )}
          </Card.Body>
        </Card.Root>
        {manager && (
          <ManagerNoteField
            key={application.id}
            id={application.id}
            note={data.myNote}
            locked={noteLocked}
          />
        )}
      </ScrollViewLayout>
      {confirmation && (
        <ConfirmationBottomSheet
          title="Delete application?"
          message="This withdraws your application; it does not delete its history. You will no longer be able to edit or submit it. This cannot be undone."
          confirmTitle="Withdraw application"
          successMessage="Application withdrawn."
          pendingMessage="Pending. Withdrawal has not been confirmed by the server."
          onClose={() => setConfirmation(null)}
          onConfirm={() =>
            withdraw.mutateAsync({
              input: { id: confirmation.id, expectedVersion: confirmation.version },
              confirmed: true,
            })
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1 },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
}));
