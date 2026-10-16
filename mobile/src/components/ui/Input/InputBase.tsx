import { useState, type ReactNode } from "react";
import {
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { StyledActivityIndicator } from "../../StyledActivityIndicator";
import { Text } from "../Text";

export type InputSize = "sm" | "base" | "lg";

export type InputBaseChildrenProps = {
  textStyles: StyleProp<TextStyle>;
  viewStyles: StyleProp<ViewStyle>;
};

export type InputBaseProps = {
  label?: string;
  description?: string;
  isError?: boolean;
  disabled?: boolean;
  size?: InputSize;
  isLoadingLeft?: boolean;
  isLoadingRight?: boolean;
  iconLeft?: string;
  iconRight?: string;
  onIconLeftPress?: () => void;
  onIconRightPress?: () => void;
  iconLeftAccessibilityLabel?: string;
  iconRightAccessibilityLabel?: string;
  isFocused?: boolean;
  hasValue?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  children: (props: InputBaseChildrenProps) => ReactNode;
};

export function InputBase({
  label,
  description,
  isError = false,
  disabled = false,
  size = "base",
  isLoadingLeft = false,
  isLoadingRight = false,
  iconLeft,
  iconRight,
  onIconLeftPress,
  onIconRightPress,
  iconLeftAccessibilityLabel,
  iconRightAccessibilityLabel,
  isFocused = false,
  hasValue = false,
  containerStyle,
  children,
}: InputBaseProps) {
  const [labelHeight, setLabelHeight] = useState(18);
  const floating = isFocused || hasValue;
  const hasLeft = isLoadingLeft || !!iconLeft;
  const hasRight = isLoadingRight || !!iconRight;

  function adornment(
    loading: boolean,
    icon: string | undefined,
    onPress: (() => void) | undefined,
    accessibilityLabel: string | undefined,
  ) {
    if (loading) {
      return (
        <View style={styles.adornment} accessibilityLabel="Loading">
          <StyledActivityIndicator size="sm" />
        </View>
      );
    }
    if (!icon) return null;

    return (
      <TouchableOpacity
        style={styles.adornment}
        disabled={disabled || !onPress}
        onPress={onPress}
        accessible={!!onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? icon}
        accessibilityState={{ disabled: disabled || !onPress }}
      >
        <View style={styles.icon(disabled, isError)} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container(!!label, labelHeight), containerStyle]}>
      <View style={styles.frame(disabled)}>
        <View style={styles.row(size, hasLeft, hasRight)}>
          {adornment(isLoadingLeft, iconLeft, onIconLeftPress, iconLeftAccessibilityLabel)}
          {children({
            textStyles: styles.text(disabled),
            viewStyles: styles.content(size, hasLeft, hasRight),
          })}
          {adornment(isLoadingRight, iconRight, onIconRightPress, iconRightAccessibilityLabel)}
        </View>
        <View pointerEvents="none" style={styles.outline(disabled, isError, isFocused)} />
        {!!label && (
          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.labelContainer(size, hasLeft, hasRight, floating, labelHeight)}
          >
            <Text
              onLayout={(event) => setLabelHeight(event.nativeEvent.layout.height)}
              style={styles.label(floating, disabled, isError, isFocused)}
            >
              {label}
            </Text>
          </View>
        )}
      </View>
      {!!description && (
        <Text
          color={isError ? "danger.foreground" : "textSecondary"}
          accessibilityLiveRegion={isError ? "polite" : "none"}
          style={styles.description(size)}
        >
          {description}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: (hasLabel: boolean, labelHeight: number) => ({
    paddingTop: hasLabel ? labelHeight / 2 : 0,
    gap: theme.spacing.xs,
  }),
  frame: (disabled: boolean) => ({
    backgroundColor: disabled ? theme.colors.disabledBackground : theme.colors.surface,
    borderRadius: theme.radius.control,
  }),
  row: (size: InputSize, hasLeft: boolean, hasRight: boolean) => {
    const sizing = theme.sizing.inputSizes[size];
    return {
      flexDirection: "row",
      alignItems: "stretch",
      minHeight: sizing.minHeight,
      paddingLeft: hasLeft ? sizing.adornmentPadding : sizing.paddingHorizontal,
      paddingRight: hasRight ? sizing.adornmentPadding : sizing.paddingHorizontal,
    };
  },
  outline: (disabled: boolean, isError: boolean, isFocused: boolean) => ({
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.control,
    borderWidth: isFocused && !disabled ? theme.borderWidth.focused : theme.borderWidth.default,
    borderColor: isError
      ? theme.colors.semantic.danger.foreground
      : disabled
        ? theme.colors.border
        : isFocused
          ? theme.colors.primary
          : theme.colors.inputBorder,
  }),
  content: (size: InputSize, hasLeft: boolean, hasRight: boolean) => ({
    flex: 1,
    minWidth: 0,
    minHeight: theme.sizing.inputSizes[size].minHeight,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingLeft: hasLeft ? theme.spacing.sm : 0,
    paddingRight: hasRight ? theme.spacing.sm : 0,
  }),
  text: (disabled: boolean) => ({
    ...theme.typography.body,
    color: disabled ? theme.colors.disabledText : theme.colors.text,
  }),
  adornment: {
    minWidth: theme.sizing.touchTarget,
    minHeight: theme.sizing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: (disabled: boolean, isError: boolean) => ({
    width: theme.sizing.icon,
    height: theme.sizing.icon,
    borderRadius: theme.radius.badge,
    borderWidth: theme.borderWidth.default,
    borderColor: disabled
      ? theme.colors.disabledText
      : isError
        ? theme.colors.semantic.danger.foreground
        : theme.colors.textSecondary,
  }),
  labelContainer: (
    size: InputSize,
    hasLeft: boolean,
    hasRight: boolean,
    floating: boolean,
    labelHeight: number,
  ) => ({
    position: "absolute",
    top: floating ? -labelHeight / 2 : 0,
    bottom: floating ? undefined : 0,
    left: floating
      ? theme.sizing.inputSizes[size].paddingHorizontal - theme.spacing.xs
      : hasLeft
        ? theme.sizing.inputSizes[size].adornmentPadding +
          theme.sizing.touchTarget +
          theme.spacing.sm
        : theme.sizing.inputSizes[size].paddingHorizontal,
    right:
      !floating && hasRight
        ? theme.sizing.inputSizes[size].adornmentPadding +
          theme.sizing.touchTarget +
          theme.spacing.sm
        : theme.sizing.inputSizes[size].paddingHorizontal,
    alignItems: "flex-start",
    justifyContent: "center",
  }),
  label: (floating: boolean, disabled: boolean, isError: boolean, isFocused: boolean) => ({
    ...(floating ? theme.typography.supporting : theme.typography.body),
    paddingHorizontal: floating ? theme.spacing.xs : 0,
    backgroundColor: floating
      ? disabled
        ? theme.colors.disabledBackground
        : theme.colors.surface
      : theme.colors.transparent,
    color: isError
      ? theme.colors.semantic.danger.foreground
      : disabled
        ? theme.colors.disabledText
        : isFocused
          ? theme.colors.primary
          : theme.colors.textMuted,
  }),
  description: (size: InputSize) => ({
    paddingHorizontal: theme.sizing.inputSizes[size].paddingHorizontal,
  }),
}));
