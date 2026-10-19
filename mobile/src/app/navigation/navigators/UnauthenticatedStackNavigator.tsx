import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { UnauthenticatedStackParamList } from "@/app/navigation/types";
import { Routes } from "@/app/navigation/routes";
import { LoginScreen, RegisterScreen, NoConnectionScreen } from "@/screens";

const Stack = createNativeStackNavigator<UnauthenticatedStackParamList>();

export function UnauthenticatedStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.Login} component={LoginScreen} />
      <Stack.Screen name={Routes.Register} component={RegisterScreen} />
      <Stack.Screen name={Routes.NoConnection} component={NoConnectionScreen} />
    </Stack.Navigator>
  );
}
