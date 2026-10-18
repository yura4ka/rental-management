import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";

export type ToastProps = { message: string; variant: "success" | "error" };

export function Toast({ message, variant }: ToastProps) {
  styles.useVariants({ variant });
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
    padding: theme.spacing.lg,
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    boxShadow: theme.shadows.raised,
    variants: {
      variant: {
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
        success: { color: theme.colors.semantic.success.foreground },
        error: { color: theme.colors.semantic.danger.foreground },
      },
    },
  },
}));
