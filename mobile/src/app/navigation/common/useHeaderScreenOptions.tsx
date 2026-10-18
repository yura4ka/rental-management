import React, { useMemo } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Text } from "@/components/ui";
import { Icon } from "@/components";

export const HeaderIcon = () => {
  return <Icon name="TIconChevronLeftOutline" color={"textSecondary"} />;
};

const HeaderTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <Text variant="cardTitle" style={styles.header}>
      {children}
    </Text>
  );
};

export const useHeaderScreenOptions = () => {
  const { theme } = useUnistyles();

  return useMemo(
    () =>
      ({
        headerShown: true,
        headerBackButtonDisplayMode: "minimal",
        headerTitle: HeaderTitle,
        headerTitleAlign: "center",
        headerLeftContainerStyle: { left: 16 },
        headerRightContainerStyle: { right: 16 },
        headerPressOpacity: 0.8,
        headerStyle: {
          backgroundColor: theme.colors.background,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
          shadowColor: "transparent",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        headerBackImage: HeaderIcon,
      }) as const,
    [theme],
  );
};

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: theme.spacing.lg,
  },
}));
