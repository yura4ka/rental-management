import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Routes } from "@/app/navigation/routes";
import type { UnauthenticatedStackScreenProps } from "@/app/navigation/types";
import { AuthCard } from "@/components/layout";
import { Text } from "@/components/ui";
import { useIsOnline } from "@/services/network/hooks";

export function NoConnectionScreen({
  navigation,
}: UnauthenticatedStackScreenProps<Routes.NoConnection>) {
  const isOnline = useIsOnline();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused && isOnline) navigation.replace(Routes.Login);
  }, [isFocused, isOnline, navigation]);

  return (
    <AuthCard title="No internet connection">
      <Text>We’ll return you to login when you’re back online.</Text>
    </AuthCard>
  );
}
