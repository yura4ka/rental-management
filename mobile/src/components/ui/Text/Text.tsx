import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";
import { StyleSheet, type UnistylesVariants } from "react-native-unistyles";

export type TextProps = ComponentProps<typeof RNText> &
  UnistylesVariants<typeof styles> &
  UnistylesVariants<typeof overrideStyles>;

export function Text({
  variant = "body",
  color = "text",
  fontFamily,
  size,
  textDecoration,
  align,
  style,
  ...props
}: TextProps) {
  styles.useVariants({ variant, color });
  overrideStyles.useVariants({ fontFamily, size, textDecoration, align });

  return <RNText {...props} style={[styles.text, overrideStyles.text, style]} />;
}

const styles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      variant: theme.typography,
      color: theme.colorVariants,
    },
  },
}));

const overrideStyles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      fontFamily: theme.fontFamilyVariants,
      size: theme.fontSize,
      textDecoration: {
        none: { textDecorationLine: "none" },
        underline: { textDecorationLine: "underline" },
        "line-through": { textDecorationLine: "line-through" },
        "underline line-through": {
          textDecorationLine: "underline line-through",
        },
      },
      align: {
        auto: { textAlign: "auto" },
        left: { textAlign: "left" },
        center: { textAlign: "center" },
        right: { textAlign: "right" },
        justify: { textAlign: "justify" },
      },
    },
  },
}));
