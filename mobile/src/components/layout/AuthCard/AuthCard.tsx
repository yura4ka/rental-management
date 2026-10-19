import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyleSheet } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { Text } from "@/components/ui";

export function AuthCard({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAwareScrollView
        mode="layout"
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="screenTitle">Rental</Text>
        <Card.Root style={styles.card}>
          <Card.Header title={title} />
          <Card.Body>{children}</Card.Body>
        </Card.Root>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 440,
  },
}));
