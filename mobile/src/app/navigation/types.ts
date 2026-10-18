import { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Routes } from "./routes";

export type RootStackParamList = {
  [Routes.Initializing]: undefined;
  [Routes.UnauthenticatedStack]: NavigatorScreenParams<UnauthenticatedStackParamList>;
  [Routes.AuthenticatedStack]: NavigatorScreenParams<AuthenticatedStackParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type UnauthenticatedStackParamList = {
  [Routes.Login]: undefined;
  [Routes.Register]: undefined;
  [Routes.NoConnection]: undefined;
};

export type UnauthenticatedStackScreenProps<T extends keyof UnauthenticatedStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<UnauthenticatedStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type AuthenticatedStackParamList = {
  [Routes.Loading]: undefined;
  [Routes.Profile]: undefined;
  [Routes.PropertyDetails]: { propertyId: string };
  [Routes.BottomTabs]: NavigatorScreenParams<BottomTabsParamList>;
};

export type AuthenticatedStackScreenProps<T extends keyof AuthenticatedStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthenticatedStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type BottomTabsParamList = {
  [Routes.Home]: undefined;
  [Routes.AvailableUnits]: undefined;
  [Routes.MyProperties]: undefined;
  [Routes.Applications]: undefined;
};

export type BottomTabsScreenProps<T extends keyof BottomTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<BottomTabsParamList, T>,
  AuthenticatedStackScreenProps<keyof AuthenticatedStackParamList>
>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
