import { Text } from "@/components/ui";
import { Routes, type BottomTabsScreenProps } from "@/app/navigation";

type HomeScreenProps = BottomTabsScreenProps<Routes.Home>;

export function HomeScreen({}: HomeScreenProps) {
  return <Text>HomeScreen</Text>;
}
