import { useEffect } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { StyledActivityIndicator } from "@/components";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";

type LoadingScreenProps = AuthenticatedStackScreenProps<Routes.Loading>;

export function LoadingScreen({ navigation }: LoadingScreenProps) {
  useEffect(() => {
    navigation.replace(Routes.BottomTabs, { screen: Routes.Home });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StyledActivityIndicator size="large" color={"primary"} accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
}));
