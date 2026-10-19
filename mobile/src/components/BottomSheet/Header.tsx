import type { ComponentProps } from "react";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { IconName } from "@/app/assets/icons";
import { Icon } from "@/components/Icon";
import { Text } from "@/components/ui/Text";
import { useRootContext } from "./context";

export type BottomSheetHeaderProps = ComponentProps<typeof View> & {
  title?: string;
  iconLeft?: IconName;
  iconRight?: IconName;
  noCloseButton?: boolean;
  border?: boolean;
};

export function Header({
  title,
  iconLeft,
  iconRight,
  noCloseButton = false,
  border = false,
  children,
  style,
  ...props
}: BottomSheetHeaderProps) {
  const { ref } = useRootContext();
  const { theme } = useUnistyles();
  const showCloseButton = !iconRight && !noCloseButton;

  return (
    <View {...props} style={[styles.header, border && styles.borderBottom, style]}>
      {(title !== undefined || iconLeft || iconRight || showCloseButton) && (
        <View style={styles.headerRow}>
          {iconLeft && <Icon name={iconLeft} />}
          {title !== undefined && (
            <Text variant="cardTitle" style={styles.title}>
              {title}
            </Text>
          )}
          {iconRight ? (
            <View style={styles.iconRight}>
              <Icon name={iconRight} />
            </View>
          ) : showCloseButton ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close bottom sheet"
              onPress={() => void ref.current?.dismiss()}
              style={styles.closeButton}
            >
              <Icon name="TIconX" color={theme.colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  iconRight: {
    marginLeft: "auto",
  },
  closeButton: {
    marginLeft: "auto",
    minWidth: theme.sizing.touchableSizes.base.minHeight,
    minHeight: theme.sizing.touchableSizes.base.minHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.control,
  },
  borderBottom: {
    borderBottomWidth: theme.borderWidth.default,
    borderBottomColor: theme.colors.border,
  },
}));
