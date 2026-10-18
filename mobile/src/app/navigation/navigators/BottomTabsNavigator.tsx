import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomTabsParamList } from "@/app/navigation/types";
import { Routes } from "@/app/navigation/routes";
import { TabBarElements } from "@/app/navigation/components";
import { useHeaderScreenOptions } from "@/app/navigation/common";
import { AvailableUnitsScreen, HomeScreen } from "@/screens";
import { MyPropertiesScreen } from "@/screens/MyPropertiesScreen";
import { useSessionState } from "@/services/session";

const Tab = createBottomTabNavigator<BottomTabsParamList>();

export function BottomTabsNavigator() {
  const headerOptions = useHeaderScreenOptions();
  const account = useSessionState((state) => state.account);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarLabel: TabBarElements.TabLabel,
        ...headerOptions,
      }}
    >
      <Tab.Screen
        name={Routes.Home}
        component={HomeScreen}
        options={{
          title: "Home",
          tabBarIcon: TabBarElements.HomeIcon,
        }}
      />
      <Tab.Screen
        name={Routes.AvailableUnits}
        component={AvailableUnitsScreen}
        options={{ title: "Browse", tabBarIcon: TabBarElements.AvailableUnitsIcon }}
      />
      {account?.role === "PropertyManager" && (
        <Tab.Screen
          name={Routes.MyProperties}
          component={MyPropertiesScreen}
          options={{ title: "My Properties", tabBarIcon: TabBarElements.AvailableUnitsIcon }}
        />
      )}
    </Tab.Navigator>
  );
}
