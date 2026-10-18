import { useUnistyles } from "react-native-unistyles";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { InitializingScreen } from "@/screens";
import { useStatus } from "@/services/session";
import { Routes } from "./routes";
import { AuthenticatedStackNavigator, UnauthenticatedStackNavigator } from "./navigators";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootStack() {
  const status = useStatus();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {status === "not-ready" ? (
        <Stack.Screen name={Routes.Initializing} component={InitializingScreen} />
      ) : status === "unauthenticated" ? (
        <Stack.Screen
          name={Routes.UnauthenticatedStack}
          component={UnauthenticatedStackNavigator}
        />
      ) : (
        <Stack.Screen name={Routes.AuthenticatedStack} component={AuthenticatedStackNavigator} />
      )}
    </Stack.Navigator>
  );
}

export function Navigation() {
  const { theme } = useUnistyles();
  const navigationTheme: Theme = {
    ...DefaultTheme,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.semantic.danger.foreground,
    },
    fonts: {
      regular: { fontFamily: theme.fontFamily.regular, fontWeight: "400" },
      medium: { fontFamily: theme.fontFamily.medium, fontWeight: "500" },
      bold: { fontFamily: theme.fontFamily.bold, fontWeight: "700" },
      heavy: { fontFamily: theme.fontFamily.bold, fontWeight: "700" },
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack />
    </NavigationContainer>
  );
}
