import { useEffect } from "react";
import { StyleSheet } from "react-native-unistyles";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "@/components/ui";
import { useSession, useSessionState } from "@/services/session";
import { StyledActivityIndicator } from "@/components";

export function InitializingScreen() {
  const session = useSession();
  const error = useSessionState((state) => state.error);
  const isBusy = useSessionState((state) => state.isBusy);

  useEffect(() => {
    session.init().catch(() => {});
  }, [session]);

  return (
    <SafeAreaView style={styles.container}>
      {error && !isBusy ? (
        <>
          <Text accessibilityRole="header">Unable to start the app</Text>
          <Text>{error instanceof Error ? error.message : "Please try again."}</Text>
          <Button title="Retry" onPress={() => session.init().catch(() => {})} />
        </>
      ) : (
        <>
          <StyledActivityIndicator accessibilityLabel="Initializing" />
          <Text>Getting things ready…</Text>
        </>
      )}
    </SafeAreaView>
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
