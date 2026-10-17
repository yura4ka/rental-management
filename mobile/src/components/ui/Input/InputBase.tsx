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
import { useAnimatedVariantColor } from "react-native-unistyles/reanimated";
import { IconName } from "@/app/assets/icons";
import { Icon } from "@/components/Icon/Icon";
import { StyledActivityIndicator } from "../../StyledActivityIndicator";
import { Text } from "../Text";

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
  iconLeft?: IconName;
  iconRight?: IconName;
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
  styles.useVariants({
    state: isFocused ? "focused" : disabled ? "disabled" : isError ? "error" : "normal",
  });

  const floating = isFocused || hasValue;
  const hasLeft = isLoadingLeft || !!iconLeft;
  const hasRight = isLoadingRight || !!iconRight;

  const animatedIconColor = useAnimatedVariantColor(styles.icon, "color");

  const adornment = (
    loading: boolean,
    icon: IconName | undefined,
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
        <Icon name={icon} color={animatedIconColor} transitionDuration={TRANSITION_DURATION} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        style={[
          styles.frame,
          isFocused && styles.frameFocused,
          disabled && styles.frameDisabled,
          isError && styles.frameError,
          {
            transitionProperty: ["backgroundColor", "outlineColor", "outlineWidth"],
            transitionDuration: TRANSITION_DURATION,
            transitionTimingFunction: "ease",
          },
        ]}
      >
        <View style={styles.row(size)}>
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
                transitionTimingFunction: "ease",
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
                  transitionTimingFunction: "ease",
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
  row: (size: InputSize) => {
    const sizing = theme.sizing.inputSizes[size];
    return {
      flexDirection: "row",
      alignItems: "stretch",
      minHeight: sizing.minHeight,
      paddingHorizontal: sizing.paddingHorizontal,
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
    minWidth: theme.sizing.icon,
    minHeight: theme.sizing.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    variants: {
      state: {
        normal: { color: theme.colors.textSecondary },
        error: { color: theme.colors.semantic.danger.foreground },
        disabled: { color: theme.colors.disabledText },
        focused: { color: theme.colors.primary },
      },
    },
  },
  labelContainer: (size: InputSize, hasLeft: boolean) => {
    const sizing = theme.sizing.inputSizes[size];
    const left = hasLeft
      ? sizing.paddingHorizontal + theme.sizing.icon + theme.spacing.sm
      : sizing.paddingHorizontal;

    return {
      position: "absolute",
      top: (sizing.minHeight - 20) / 2,
      left: left - theme.spacing.xs,
      backgroundColor: theme.colors.surface,
    };
  },
  labelContainerFloating: (size: InputSize) => ({
    top: -18 / 2,
    left: theme.sizing.inputSizes[size].paddingHorizontal - theme.spacing.xs,
  }),
  labelContainerDisabled: {
    backgroundColor: theme.colors.disabledBackground,
  },
  label: {
    fontFamily: theme.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.xs,
    color: theme.colors.textMuted,
  },
  labelFloating: {
    fontSize: 12,
    lineHeight: 18,
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
