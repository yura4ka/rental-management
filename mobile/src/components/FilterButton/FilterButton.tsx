import type { ComponentProps } from "react";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { IconName } from "@/app/assets/icons";
import { Icon } from "@/components/Icon";

export type FilterButtonProps = Omit<ComponentProps<typeof TouchableOpacity>, "children"> & {
  icon: IconName;
  isActive: boolean;
  accessibilityLabel: string;
};

export function FilterButton({
  icon,
  isActive,
  style,
  accessibilityState,
  ...props
}: FilterButtonProps) {
  return (
    <TouchableOpacity
      hitSlop={4}
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, selected: isActive }}
      style={[styles.button, style]}
    >
      <Icon name={icon} size={20} />
      {isActive && <View style={styles.dot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.border,
  },
  dot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
}));
