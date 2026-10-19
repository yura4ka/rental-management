import type { ComponentProps } from "react";
import { TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "../Text";

export type ChipProps = Omit<ComponentProps<typeof TouchableOpacity>, "children"> & {
  title: string;
  selected?: boolean;
};

export function Chip({
  title,
  selected = false,
  disabled,
  style,
  accessibilityState,
  ...props
}: ChipProps) {
  styles.useVariants({ selected });
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      hitSlop={{ top: 8, bottom: 8 }}
      {...props}
      disabled={disabled}
      accessibilityState={{ ...accessibilityState, selected, checked: selected, disabled }}
      style={[styles.chip, disabled && styles.disabled, style]}
    >
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    minHeight: 32,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.default,
    alignItems: "center",
    justifyContent: "center",
    variants: {
      selected: {
        false: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.primary },
        true: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
      },
    },
  },
  title: {
    ...theme.typography.supporting,
    fontFamily: theme.fontFamily.semibold,
    variants: {
      selected: {
        false: { color: theme.colors.primary },
        true: { color: theme.colors.textOnPrimary },
      },
    },
  },
  disabled: { opacity: 0.5 },
}));
