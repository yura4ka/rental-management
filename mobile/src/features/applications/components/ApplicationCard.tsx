import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import type { ApplicationDto } from "../types";
import { applicationDate } from "../presentation";
import { ApplicationBadge } from "./ApplicationBadge";

export function ApplicationCard({ item, onPress }: { item: ApplicationDto; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" style={styles.card} onPress={onPress}>
      <View style={styles.badges}>
        <ApplicationBadge status={item.status} />
        {item.isArchived && <ApplicationBadge title="Archived inventory" />}
      </View>
      <Text fontFamily="semibold">{item.applicantName}</Text>
      <Text>
        {getAddressDisplayName(item.propertyAddress)} · Unit {item.unitNumber}
      </Text>
      <Text color="textSecondary">Created {applicationDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
}));
