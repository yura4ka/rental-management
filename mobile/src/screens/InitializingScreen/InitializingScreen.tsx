import { useEffect } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/components/ui";
import { useSession, useSessionState } from "@/services/session";
import { StyledActivityIndicator } from "@/components";

export function InitializingScreen() {
  const session = useSession();
  const error = useSessionState((state) => state.error);

  useEffect(() => {
    session.init().catch(() => {});
  }, [session]);

  return (
    <View style={styles.container}>
      {error !== null ? (
        <Text color="danger.foreground" align="center" accessibilityRole="alert">
          {error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unable to initialize the session."}
        </Text>
      ) : (
        <StyledActivityIndicator size="large" color={"primary"} accessibilityLabel="Loading" />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xxl,
    backgroundColor: theme.colors.background,
  },
}));
