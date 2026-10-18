import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { Button, Text } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import { ProfileInformationEditor } from "@/features/applicantProfile/components/ProfileInformationEditor";
import { ResidenceHistoryEditor } from "@/features/applicantProfile/components/ResidenceHistoryEditor";
import { compareResidences } from "@/features/applicantProfile/forms/utils";
import { useApplicantProfile } from "@/features/applicantProfile/hooks";
import type { GetApplicantProfileResponse } from "@/features/applicantProfile/types";
import { useGetAccount } from "@/features/auth/hooks";

type Editor = { section: "information" | "residences"; profile: GetApplicantProfileResponse };

function ProfileValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.value}>
      <Text variant="supporting" color="textSecondary">
        {label}
      </Text>
      <Text>{value || "Not provided"}</Text>
    </View>
  );
}

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
      <ScrollView contentContainerStyle={styles.content}>
        {profile.isError && (
          <View style={styles.value}>
            <Text color="warning.foreground">
              Showing previously downloaded profile data. Refresh failed.
            </Text>
            <Button title="Retry" variant="textPrimary" onPress={() => void profile.refetch()} />
          </View>
        )}
        <Card.Root>
          <Card.Header>
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
            <ProfileValue label="Email" value={account.data?.email} />
            {account.isError && (
              <Button
                title="Retry email"
                variant="textPrimary"
                onPress={() => void account.refetch()}
              />
            )}
            <ProfileValue label="Name" value={information.name} />
            <ProfileValue label="Phone" value={information.phone} />
            <ProfileValue label="Contact email" value={information.contactEmail} />
            <ProfileValue
              label="Current address"
              value={getAddressDisplayName(information.currentAddress)}
            />
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Header>
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
      </ScrollView>
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
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { flex: 1 },
  value: { gap: theme.spacing.xs },
  state: { flex: 1, justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.md },
}));
