import type { ComponentProps } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { IconName } from "@/app/assets/icons";
import { Icon } from "@/components/Icon/Icon";
import { Text } from "@/components/ui/Text";

export type CardRootProps = ComponentProps<typeof View>;

export type CardHeaderProps = ComponentProps<typeof View> & {
  title?: string;
  iconLeft?: IconName;
  iconRight?: IconName;
  border?: boolean;
};

export type CardBodyProps = ComponentProps<typeof View>;

export type CardFooterProps = ComponentProps<typeof View> & {
  border?: boolean;
};

function CardRoot({ style, ...props }: CardRootProps) {
  return <View {...props} style={[styles.root, style]} />;
}

function CardHeader({
  title,
  iconLeft,
  iconRight,
  border = false,
  children,
  style,
  ...props
}: CardHeaderProps) {
  return (
    <View {...props} style={[styles.header, border && styles.borderBottom, style]}>
      {(title !== undefined || iconLeft || iconRight) && (
        <View style={styles.headerRow}>
          {iconLeft && <Icon name={iconLeft} />}
          {title !== undefined && (
            <Text variant="cardTitle" style={styles.title}>
              {title}
            </Text>
          )}
          {iconRight && (
            <View style={styles.iconRight}>
              <Icon name={iconRight} />
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

function CardBody({ style, ...props }: CardBodyProps) {
  return <View {...props} style={[styles.body, style]} />;
}

function CardFooter({ border = false, style, ...props }: CardFooterProps) {
  return <View {...props} style={[styles.footer, border && styles.borderTop, style]} />;
}

export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
};

const styles = StyleSheet.create((theme) => ({
  root: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
  },
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
  body: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  footer: {
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  borderBottom: {
    borderBottomWidth: theme.borderWidth.default,
    borderBottomColor: theme.colors.border,
  },
  borderTop: {
    borderTopWidth: theme.borderWidth.default,
    borderTopColor: theme.colors.border,
  },
}));
