import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";
import type { ApplicationStatus } from "../types";
import { statusLabel } from "../presentation";

export function ApplicationBadge({
  status,
  title,
}: {
  status?: ApplicationStatus;
  title?: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        status === "Approved" && styles.approved,
        status === "Denied" && styles.denied,
        (status === "Returned" || !status) && styles.warning,
      ]}
    >
      <Text variant="supporting" fontFamily="semibold">
        {status ? statusLabel(status) : title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  approved: {
    borderColor: theme.colors.semantic.success.border,
    backgroundColor: theme.colors.semantic.success.background,
  },
  denied: {
    borderColor: theme.colors.semantic.danger.border,
    backgroundColor: theme.colors.semantic.danger.background,
  },
  warning: {
    borderColor: theme.colors.semantic.warning.border,
    backgroundColor: theme.colors.semantic.warning.background,
  },
}));
