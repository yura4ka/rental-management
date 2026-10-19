import { ActivityIndicator, RefreshControl, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Button, Text } from "@/components/ui";
import { Routes } from "@/app/navigation/routes";
import type { BottomTabsScreenProps } from "@/app/navigation/types";
import { FilterButton } from "@/components/FilterButton";
import { ScrollViewLayout } from "@/components/layout";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { ApplicationCard } from "@/features/applications/components/ApplicationCard";
import { getRecentApplications } from "@/features/applications/recentApplications";
import { useOperations } from "@/features/operations/hooks";
import { useSession, useSessionState } from "@/services/session";

type HomeScreenProps = BottomTabsScreenProps<Routes.Home>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const session = useSession();
  const manager = useSessionState((state) => state.account?.role === "PropertyManager");
  const focused = useIsFocused();
  const operations = useOperations(focused);
  const query = useQuery({
    queryKey: ["applications", "recent", { manager }],
    queryFn: ({ signal }) =>
      getRecentApplications(
        session.getService("applications"),
        manager ? session.getService("properties") : null,
        signal,
      ),
  });
  const pending = operations.data?.some(
    (item) => !item.dismissedAt && !["Accepted", "Cancelled"].includes(item.state),
  );

  return (
    <ScrollViewLayout
      edges={["top", "left", "right"]}
      beforeScroll={
        <View style={styles.header}>
          <Text variant="screenTitle" style={styles.title}>
            Rental
          </Text>
          <FilterButton
            icon="TIconClockOutline"
            accessibilityLabel={manager ? "Pending actions" : "Pending operations"}
            isActive={!!pending}
            onPress={() => navigation.navigate(Routes.PendingOperations)}
          />
          {manager ? (
            <LogoutButton />
          ) : (
            <FilterButton
              icon="TIconUserOutline"
              accessibilityLabel="Profile"
              isActive={false}
              onPress={() => navigation.navigate(Routes.Profile)}
            />
          )}
        </View>
      }
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
    >
      <Text variant="cardTitle">Recent applications</Text>
      {query.data?.offline && (
        <Text color="textSecondary">
          Showing offline data. Only previously downloaded records are included.
        </Text>
      )}
      {(query.isError || query.data?.fallback) && (
        <View style={styles.feedback}>
          <Text>Could not refresh recent applications.</Text>
          <Button title="Retry" variant="textPrimary" onPress={() => void query.refetch()} />
        </View>
      )}
      {query.isPending ? (
        <ActivityIndicator accessibilityLabel="Loading recent applications" />
      ) : (
        <>
          {query.data?.items.map((item) => (
            <ApplicationCard
              key={item.id}
              item={item}
              onPress={() =>
                navigation.navigate(Routes.ApplicationDetails, { applicationId: item.id })
              }
            />
          ))}
          {query.data?.items.length === 0 && (
            <Text color="textSecondary">
              {query.data.offline
                ? "No matching downloaded applications."
                : manager
                  ? "No applications for your properties yet."
                  : "You have no applications yet."}
            </Text>
          )}
        </>
      )}
    </ScrollViewLayout>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  title: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  feedback: {
    gap: theme.spacing.sm,
  },
}));
