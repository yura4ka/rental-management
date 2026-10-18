import type { ComponentProps } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export type BottomSheetFooterProps = ComponentProps<typeof View> & {
  border?: boolean;
};

export function Footer({ border = false, style, ...props }: BottomSheetFooterProps) {
  return <View {...props} style={[styles.footer, border && styles.borderTop, style]} />;
}

const styles = StyleSheet.create((theme) => ({
  footer: {
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  borderTop: {
    borderTopWidth: theme.borderWidth.default,
    borderTopColor: theme.colors.border,
  },
}));
