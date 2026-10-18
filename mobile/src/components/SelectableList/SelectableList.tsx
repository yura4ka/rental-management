import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";

export function SelectableList<Value extends string | number>({
  items,
  value,
  onChange,
}: {
  items: readonly { label: string; value: Value }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return items.map((item) => {
    const selected = item.value === value;
    return (
      <TouchableOpacity
        key={item.value}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        style={[styles.item, selected && styles.selected]}
        onPress={() => onChange(item.value)}
      >
        <View style={[styles.radio, selected && styles.selected]}>
          {selected && <View style={styles.dot} />}
        </View>
        <Text style={styles.label}>{item.label}</Text>
      </TouchableOpacity>
    );
  });
}

const styles = StyleSheet.create((theme) => ({
  item: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.border,
  },
  selected: {
    borderColor: theme.colors.primary,
    outlineColor: theme.colors.primary,
    outlineWidth: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  label: { flex: 1 },
}));
