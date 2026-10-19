import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";

export type ToastProps = { message: string; variant: "info" | "success" | "error" };

export function Toast({ message, variant }: ToastProps) {
  styles.useVariants({ variant });
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme, miniRuntime) => ({
  container: {
    width: miniRuntime.screen.width - theme.spacing.lg * 2,
    padding: theme.spacing.lg,
    marginHorizontal: "auto",
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    boxShadow: theme.shadows.raised,
    variants: {
      variant: {
        info: {
          backgroundColor: theme.colors.semantic.info.background,
          borderColor: theme.colors.semantic.info.border,
        },
        success: {
          backgroundColor: theme.colors.semantic.success.background,
          borderColor: theme.colors.semantic.success.border,
        },
        error: {
          backgroundColor: theme.colors.semantic.danger.background,
          borderColor: theme.colors.semantic.danger.border,
        },
      },
    },
  },
  message: {
    ...theme.typography.body,
    variants: {
      variant: {
        info: { color: theme.colors.semantic.info.foreground },
        success: { color: theme.colors.semantic.success.foreground },
        error: { color: theme.colors.semantic.danger.foreground },
      },
    },
  },
}));
