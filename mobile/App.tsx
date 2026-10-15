import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function App() {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <SafeAreaView>
          <StatusBar style="auto" />
          <Text>Open up App.tsx to start working on your app!</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
