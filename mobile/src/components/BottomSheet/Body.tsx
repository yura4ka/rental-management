import type { ComponentProps } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export type BottomSheetBodyProps = ComponentProps<typeof View>;

export function Body({ style, ...props }: BottomSheetBodyProps) {
  return <View {...props} style={[styles.body, style]} />;
}

const styles = StyleSheet.create((theme) => ({
  body: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
}));
