import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { LabelValue } from "@/components/LabelValue";
import { Button, Text } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import { ProfileInformationEditor } from "@/features/applicantProfile/components/ProfileInformationEditor";
import { ResidenceHistoryEditor } from "@/features/applicantProfile/components/ResidenceHistoryEditor";
import { compareResidences } from "@/features/applicantProfile/forms/utils";
import { useApplicantProfile } from "@/features/applicantProfile/hooks";
import type { GetApplicantProfileResponse } from "@/features/applicantProfile/types";
import { useGetAccount } from "@/features/auth/hooks";
import { ScrollViewLayout } from "@/components/layout";

type Editor = { section: "information" | "residences"; profile: GetApplicantProfileResponse };

export function ProfileScreen() {
  const profile = useApplicantProfile();
  const account = useGetAccount();
  const [editor, setEditor] = useState<Editor | null>(null);
  const data = profile.data;

  if (!data) {
    return (
      <View style={styles.state}>
        {profile.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading profile" />
        ) : (
          <>
            <Text>Profile unavailable. Connect to download your profile, or try again.</Text>
            <Button title="Retry" onPress={() => void profile.refetch()} />
          </>
        )}
      </View>
    );
  }

  const information = data.applicantInformation;
  return (
    <>
      <ScrollViewLayout
        edges={["bottom", "left", "right"]}
        contentContainerStyle={styles.container}
      >
        {profile.isError && (
          <View style={styles.value}>
            <Text color="warning.foreground">
              Showing previously downloaded profile data. Refresh failed.
            </Text>
            <Button title="Retry" variant="textPrimary" onPress={() => void profile.refetch()} />
          </View>
        )}
        <Card.Root>
          <Card.Header border={true}>
            <View style={styles.cardHeader}>
              <Text variant="cardTitle" style={styles.title}>
                Profile
              </Text>
              <Button
                title="Edit"
                accessibilityLabel="Edit profile"
                iconLeft="TIconPencilOutline"
                variant="textPrimary"
                size="sm"
                onPress={() => setEditor({ section: "information", profile: data })}
              />
            </View>
          </Card.Header>
          <Card.Body>
            <LabelValue
              items={[
                { label: "Email", value: account.data?.email },
                { label: "Name", value: information.name },
                { label: "Phone", value: information.phone },
                { label: "Contact email", value: information.contactEmail },
                {
                  label: "Current address",
                  value: getAddressDisplayName(information.currentAddress),
                },
              ]}
            />
            {account.isError && (
              <Button
                title="Retry email"
                variant="textPrimary"
                onPress={() => void account.refetch()}
              />
            )}
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Header border={true}>
            <View style={styles.cardHeader}>
              <Text variant="cardTitle" style={styles.title}>
                Past residences
              </Text>
              <Button
                title="Edit"
                accessibilityLabel="Edit past residences"
                iconLeft="TIconPencilOutline"
                variant="textPrimary"
                size="sm"
                onPress={() => setEditor({ section: "residences", profile: data })}
              />
            </View>
          </Card.Header>
          <Card.Body>
            {data.residenceHistory.length === 0 ? (
              <Text color="textSecondary">No past residences.</Text>
            ) : (
              [...data.residenceHistory]
                .sort(compareResidences)
                .map((residence) => (
                  <Text key={residence.position}>{getAddressDisplayName(residence.address)}</Text>
                ))
            )}
          </Card.Body>
        </Card.Root>
      </ScrollViewLayout>
      {editor?.section === "information" && (
        <ProfileInformationEditor profile={editor.profile} onClose={() => setEditor(null)} />
      )}
      {editor?.section === "residences" && (
        <ResidenceHistoryEditor profile={editor.profile} onClose={() => setEditor(null)} />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  value: {
    gap: theme.spacing.xs,
  },
  state: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
}));
