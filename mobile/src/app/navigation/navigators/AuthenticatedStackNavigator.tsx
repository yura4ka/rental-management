import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthenticatedStackParamList } from "@/app/navigation/types";
import { Routes } from "@/app/navigation/routes";
import { BottomTabsNavigator } from "@/app/navigation/navigators/BottomTabsNavigator";
import { ProfileScreen, LoadingScreen } from "@/screens";
import { useHeaderScreenOptions } from "@/app/navigation/common/useHeaderScreenOptions";
import { PropertyDetailsScreen } from "@/screens/PropertyDetailsScreen";
import { ApplicationDetailsScreen } from "@/screens/ApplicationDetailsScreen/ApplicationDetailsScreen";
import { ApplicationFormScreen } from "@/screens/ApplicationFormScreen/ApplicationFormScreen";
import { PendingOperationsScreen } from "@/screens/PendingOperationsScreen";
import { LogoutButton } from "@/features/auth/components/LogoutButton";

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedStackNavigator() {
  const headerOptions = useHeaderScreenOptions();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.Loading} component={LoadingScreen} />
      <Stack.Screen name={Routes.BottomTabs} component={BottomTabsNavigator} />

      <Stack.Group screenOptions={headerOptions}>
        <Stack.Screen
          name={Routes.PendingOperations}
          component={PendingOperationsScreen}
          options={{ title: "Pending operations" }}
        />
        <Stack.Screen
          name={Routes.ApplicationForm}
          component={ApplicationFormScreen}
          options={{ title: "Application" }}
        />
        <Stack.Screen
          name={Routes.ApplicationDetails}
          component={ApplicationDetailsScreen}
          options={{ title: "Application details" }}
        />
        <Stack.Screen
          name={Routes.PropertyDetails}
          component={PropertyDetailsScreen}
          options={{ title: "Property details" }}
        />
        <Stack.Screen
          name={Routes.Profile}
          component={ProfileScreen}
          options={{ title: "Profile", headerRight: () => <LogoutButton /> }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}
