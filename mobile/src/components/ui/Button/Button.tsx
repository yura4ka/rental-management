import type { ComponentProps } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { StyleSheet, type UnistylesVariants } from "react-native-unistyles";
import type { IconName } from "@/app/assets/icons";
import { Icon } from "@/components/Icon";
import { Text } from "../Text";

export type ButtonProps = Omit<ComponentProps<typeof TouchableOpacity>, "children"> &
  UnistylesVariants<typeof styles> & {
    title: string;
    isLoadingLeft?: boolean;
    isLoadingRight?: boolean;
    iconLeft?: IconName;
    iconRight?: IconName;
  };

export function Button({
  title,
  variant = "primary",
  size = "base",
  disabled = false,
  isLoadingLeft = false,
  isLoadingRight = false,
  iconLeft,
  iconRight,
  style,
  accessibilityLabel = title,
  accessibilityState,
  ...props
}: ButtonProps) {
  styles.useVariants({ variant, size });

  const isLoading = isLoadingLeft || isLoadingRight;
  const hasLeft = isLoadingLeft || !!iconLeft;
  const hasRight = isLoadingRight || !!iconRight;
  const color = disabled ? styles.textDisabled.color : styles.text.color;

  const adornment = (loading: boolean, icon: IconName | undefined) => {
    if (!loading && !icon) return null;

    return (
      <View
        style={styles.adornment}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          icon && <Icon name={icon} color={color} />
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      {...props}
      disabled={disabled || isLoading}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        ...accessibilityState,
        disabled: disabled || isLoading,
        busy: isLoading || accessibilityState?.busy,
      }}
      style={[
        styles.button,
        hasLeft && styles.buttonWithLeftAdornment,
        hasRight && styles.buttonWithRightAdornment,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {adornment(isLoadingLeft, iconLeft)}
      <Text style={[styles.text, disabled && styles.textDisabled]}>{title}</Text>
      {adornment(isLoadingRight, iconRight)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.control,
    paddingVertical: theme.spacing.md,
    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.primary,
        },
        secondary: {
          backgroundColor: theme.colors.surface,
          outlineWidth: theme.borderWidth.default,
          outlineColor: theme.colors.border,
        },
        text: {
          backgroundColor: theme.colors.transparent,
        },
        textPrimary: {
          backgroundColor: theme.colors.transparent,
        },
      },
      size: {
        sm: {
          minHeight: theme.sizing.touchableSizes.sm.minHeight,
          paddingHorizontal: theme.sizing.touchableSizes.sm.paddingHorizontal,
        },
        base: {
          minHeight: theme.sizing.touchableSizes.base.minHeight,
          paddingHorizontal: theme.sizing.touchableSizes.base.paddingHorizontal,
        },
        lg: {
          minHeight: theme.sizing.touchableSizes.lg.minHeight,
          paddingHorizontal: theme.sizing.touchableSizes.lg.paddingHorizontal,
        },
      },
    },
  },
  buttonDisabled: {
    outlineColor: theme.colors.border,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.disabledBackground },
        secondary: { backgroundColor: theme.colors.disabledBackground },
        text: { backgroundColor: theme.colors.transparent },
        textPrimary: { backgroundColor: theme.colors.transparent },
      },
      size: {},
    },
  },
  buttonWithLeftAdornment: {
    variants: {
      variant: {},
      size: {
        sm: { paddingLeft: theme.sizing.touchableSizes.sm.adornmentPadding },
        base: { paddingLeft: theme.sizing.touchableSizes.base.adornmentPadding },
        lg: { paddingLeft: theme.sizing.touchableSizes.lg.adornmentPadding },
      },
    },
  },
  buttonWithRightAdornment: {
    variants: {
      variant: {},
      size: {
        sm: { paddingRight: theme.sizing.touchableSizes.sm.adornmentPadding },
        base: { paddingRight: theme.sizing.touchableSizes.base.adornmentPadding },
        lg: { paddingRight: theme.sizing.touchableSizes.lg.adornmentPadding },
      },
    },
  },
  text: {
    ...theme.typography.button,
    flexShrink: 1,
    textAlign: "center",
    variants: {
      variant: {
        primary: { color: theme.colors.textOnPrimary },
        secondary: { color: theme.colors.text },
        text: { color: theme.colors.text },
        textPrimary: { color: theme.colors.primary },
      },
      size: {},
    },
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
}));
