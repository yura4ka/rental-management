import { useEffect } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { toast } from "@/app/toast";
import { StyledActivityIndicator } from "@/components";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { useProcessOperations } from "@/features/operations/hooks";

type LoadingScreenProps = AuthenticatedStackScreenProps<Routes.Loading>;

export function LoadingScreen({ navigation }: LoadingScreenProps) {
  const { mutateAsync: processOperations } = useProcessOperations();

  useEffect(() => {
    void processOperations().catch(() => {
      toast.error("Could not sync pending operations. Open Pending operations to retry.");
    });
    navigation.replace(Routes.BottomTabs, { screen: Routes.Home });
  }, [navigation, processOperations]);

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
