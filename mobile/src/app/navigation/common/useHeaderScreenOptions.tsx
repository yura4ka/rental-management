import React, { useMemo } from "react";
import { StyleSheet } from "react-native-unistyles";
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
  return useMemo(
    () =>
      ({
        headerShown: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerTitle: HeaderTitle,
        headerTitleAlign: "center",
        headerLeftContainerStyle: { left: 16 },
        headerRightContainerStyle: { right: 16 },
        headerPressOpacity: 0.8,
        headerStyle: {
          backgroundColor: "transparent",
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
          shadowColor: "transparent",
          borderBottomWidth: 0,
        },
        headerBackImage: HeaderIcon,
      }) as const,
    [],
  );
};

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: theme.spacing.lg,
  },
}));
