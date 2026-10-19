import "@/app/theme/unistyles";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Toaster } from "sonner-native";
import { StatusBar } from "expo-status-bar";
import { createSession, SessionProvider } from "@/services/session";
import { createQueryClient, QueryProvider } from "@/services/query";
import { Navigation } from "@/app/navigation";

const queryClient = createQueryClient();

export default function App() {
  const [session] = useState(() => createSession(process.env.EXPO_PUBLIC_API_URL, queryClient));

  return (
    <SessionProvider session={session}>
      <StatusBar style="dark" />
      <QueryProvider client={queryClient}>
        <GestureHandlerRootView>
          <SafeAreaProvider>
            <KeyboardProvider>
              <Navigation />
              <Toaster position="top-center" />
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryProvider>
    </SessionProvider>
  );
}
