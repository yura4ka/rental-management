import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";

export type LabelValueItem = { label: string; value?: string | null };

export function LabelValue({ items }: { items: LabelValueItem[] }) {
  return (
    <View>
      {items.map(({ label, value }, index) => (
        <View key={label} style={[styles.item, index < items.length - 1 && styles.border]}>
          <Text variant="supporting" color="textSecondary">
            {label}
          </Text>
          <Text>{value || "Not provided"}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  item: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
  border: {
    borderBottomWidth: theme.borderWidth.default,
    borderBottomColor: theme.colors.border,
  },
}));
