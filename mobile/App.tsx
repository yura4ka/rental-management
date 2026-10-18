import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { createSession, SessionProvider } from "@/services/session";
import { createQueryClient, QueryProvider } from "@/services/query";
import { Navigation } from "@/app/navigation";

const queryClient = createQueryClient();

export default function App() {
  const [session] = useState(() => createSession(process.env.EXPO_PUBLIC_API_URL, queryClient));

  return (
    <SessionProvider session={session}>
      <QueryProvider client={queryClient}>
        <GestureHandlerRootView>
          <SafeAreaProvider>
            <Navigation />
            <Toaster position="top-center" />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryProvider>
    </SessionProvider>
  );
}
