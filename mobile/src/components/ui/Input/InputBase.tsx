import type { ReactNode } from "react";
import {
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { StyledActivityIndicator } from "../../StyledActivityIndicator";
import { Text } from "../Text";

const LABEL_FONT_SIZE = 14;
const LABEL_LINE_HEIGHT = 20;
const FLOATING_LABEL_FONT_SIZE = 12;
const FLOATING_LABEL_LINE_HEIGHT = 18;
const TRANSITION_DURATION = 180;

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
  const floating = isFocused || hasValue;
  const hasLeft = isLoadingLeft || !!iconLeft;
  const hasRight = isLoadingRight || !!iconRight;

  const adornment = (
    loading: boolean,
    icon: string | undefined,
    onPress: (() => void) | undefined,
    accessibilityLabel: string | undefined,
  ) => {
    if (loading) {
      return (
        <View style={styles.adornment} accessibilityLabel="Loading">
          <StyledActivityIndicator size="small" />
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
        <Animated.View
          style={[
            styles.icon,
            isError && styles.iconError,
            disabled && styles.iconDisabled,
            { transitionProperty: "borderColor", transitionDuration: TRANSITION_DURATION },
          ]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, !!label && styles.containerWithLabel, containerStyle]}>
      <Animated.View
        style={[
          styles.frame,
          isFocused && styles.frameFocused,
          disabled && styles.frameDisabled,
          isError && styles.frameError,
          {
            transitionProperty: ["backgroundColor", "outlineColor", "outlineWidth"],
            transitionDuration: TRANSITION_DURATION,
          },
        ]}
      >
        <View style={styles.row(size, hasLeft, hasRight)}>
          {adornment(isLoadingLeft, iconLeft, onIconLeftPress, iconLeftAccessibilityLabel)}
          {children({
            textStyles: [styles.text, disabled && styles.textDisabled],
            viewStyles: styles.content(size, hasLeft, hasRight),
          })}
          {adornment(isLoadingRight, iconRight, onIconRightPress, iconRightAccessibilityLabel)}
        </View>
        {!!label && (
          <Animated.View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.labelContainer(size, hasLeft),
              floating && styles.labelContainerFloating(size),
              disabled && styles.labelContainerDisabled,
              {
                transitionProperty: ["left", "top", "backgroundColor"],
                transitionDuration: TRANSITION_DURATION,
              },
            ]}
          >
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.label,
                floating && styles.labelFloating,
                isFocused && styles.labelFocused,
                disabled && styles.labelDisabled,
                isError && styles.labelError,
                {
                  transitionProperty: ["fontSize", "lineHeight", "color"],
                  transitionDuration: TRANSITION_DURATION,
                },
              ]}
            >
              {label}
            </Animated.Text>
          </Animated.View>
        )}
      </Animated.View>
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
  container: {
    gap: theme.spacing.xs,
  },
  containerWithLabel: {
    paddingTop: FLOATING_LABEL_LINE_HEIGHT / 2,
  },
  frame: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    outlineWidth: theme.borderWidth.default,
    outlineColor: theme.colors.inputBorder,
  },
  frameFocused: {
    outlineWidth: theme.borderWidth.focused,
    outlineColor: theme.colors.primary,
  },
  frameDisabled: {
    backgroundColor: theme.colors.disabledBackground,
    outlineWidth: theme.borderWidth.default,
    outlineColor: theme.colors.border,
  },
  frameError: {
    outlineColor: theme.colors.semantic.danger.foreground,
  },
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
  content: (size: InputSize, hasLeft: boolean, hasRight: boolean) => ({
    flex: 1,
    minHeight: theme.sizing.inputSizes[size].minHeight,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingLeft: hasLeft ? theme.spacing.sm : 0,
    paddingRight: hasRight ? theme.spacing.sm : 0,
  }),
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  textDisabled: {
    color: theme.colors.disabledText,
  },
  adornment: {
    minWidth: theme.sizing.touchTarget,
    minHeight: theme.sizing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: theme.sizing.icon,
    height: theme.sizing.icon,
    borderRadius: theme.radius.badge,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.textSecondary,
  },
  iconError: {
    borderColor: theme.colors.semantic.danger.foreground,
  },
  iconDisabled: {
    borderColor: theme.colors.disabledText,
  },
  labelContainer: (size: InputSize, hasLeft: boolean) => {
    const sizing = theme.sizing.inputSizes[size];
    const left = hasLeft
      ? sizing.adornmentPadding + theme.sizing.touchTarget + theme.spacing.sm
      : sizing.paddingHorizontal;

    return {
      position: "absolute",
      top: (sizing.minHeight - LABEL_LINE_HEIGHT) / 2,
      left: left - theme.spacing.xs,
      backgroundColor: theme.colors.surface,
    };
  },
  labelContainerFloating: (size: InputSize) => ({
    top: -FLOATING_LABEL_LINE_HEIGHT / 2,
    left: theme.sizing.inputSizes[size].paddingHorizontal - theme.spacing.xs,
  }),
  labelContainerDisabled: {
    backgroundColor: theme.colors.disabledBackground,
  },
  label: {
    fontFamily: theme.fontFamily.regular,
    fontSize: LABEL_FONT_SIZE,
    lineHeight: LABEL_LINE_HEIGHT,
    paddingHorizontal: theme.spacing.xs,
    color: theme.colors.textMuted,
  },
  labelFloating: {
    fontSize: FLOATING_LABEL_FONT_SIZE,
    lineHeight: FLOATING_LABEL_LINE_HEIGHT,
  },
  labelFocused: {
    color: theme.colors.primary,
  },
  labelDisabled: {
    color: theme.colors.disabledText,
  },
  labelError: {
    color: theme.colors.semantic.danger.foreground,
  },
  description: (size: InputSize) => ({
    paddingHorizontal: theme.sizing.inputSizes[size].paddingHorizontal,
  }),
}));
