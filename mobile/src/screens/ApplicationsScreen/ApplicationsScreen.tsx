import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Routes } from "@/app/navigation/routes";
import type { BottomTabsScreenProps } from "@/app/navigation/types";
import { FilterButton } from "@/components/FilterButton";
import { SelectableListBottomSheet } from "@/components/SelectableListBottomSheet";
import { FlatListLayout } from "@/components/layout";
import { Button, Text } from "@/components/ui";
import { ApplicationCard } from "@/features/applications/components/ApplicationCard";
import { ApplicationsFiltersSheet } from "@/features/applications/components/ApplicationsFiltersSheet";
import { LocalApplicationDrafts } from "@/features/applications/components/LocalApplicationDrafts";
import { useApplications } from "@/features/applications/hooks";
import {
  applicationSortOptions,
  defaultApplicationFilters,
  toApplicationParams,
  type ApplicationFilters,
  type ApplicationSort,
} from "@/features/applications/presentation";
import { useSessionState } from "@/services/session";
import { StyledActivityIndicator } from "@/components";

export function ApplicationsScreen({ navigation }: BottomTabsScreenProps<Routes.Applications>) {
  const manager = useSessionState((state) => state.account?.role === "PropertyManager");
  const [filters, setFilters] = useState<ApplicationFilters>(defaultApplicationFilters);
  const [sort, setSort] = useState<ApplicationSort>("createdDesc");
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const params = useMemo(
    () => toApplicationParams(filters, sort, manager),
    [filters, sort, manager],
  );
  const query = useApplications(params);
  const pages = query.data?.pages;
  const items = useMemo(
    () => [
      ...new Map(
        (pages ?? []).flatMap((page) => page.data.rows).map((item) => [item.id, item]),
      ).values(),
    ],
    [pages],
  );
  const offline = pages?.some((page) => page.source === "device");
  const fallback = pages?.some((page) => page.fallbackError != null);
  const filtersActive =
    !!filters.status || !!filters.propertyId || (manager && filters.showArchived);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <FilterButton
            icon="TIconAdjustmentsHorizontalOutline"
            accessibilityLabel="Filter applications"
            isActive={filtersActive}
            disabled={sheet !== null}
            onPress={() => setSheet("filters")}
          />
          <FilterButton
            icon="TIconArrowsSortOutline"
            accessibilityLabel="Sort applications"
            isActive={sort !== "createdDesc"}
            disabled={sheet !== null}
            onPress={() => setSheet("sort")}
          />
        </View>
      ),
    });
  }, [navigation, filtersActive, sort, sheet]);

  return (
    <>
      <FlatListLayout
        edges={["left", "right"]}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ApplicationCard
            item={item}
            onPress={() => {
              if (!sheet)
                navigation.navigate(Routes.ApplicationDetails, { applicationId: item.id });
            }}
          />
        )}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetching && !query.isError) void query.fetchNextPage();
        }}
        ListHeaderComponent={
          <>
            {!manager && <LocalApplicationDrafts />}
            {offline && (
              <Text color="textSecondary">
                Showing offline data. Only previously downloaded applications are included.
              </Text>
            )}
            {(query.isError || fallback) && (
              <View style={styles.feedback}>
                <Text>Could not refresh applications.</Text>
                <Button
                  title="Retry"
                  variant="textPrimary"
                  onPress={() =>
                    void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                  }
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <StyledActivityIndicator accessibilityLabel="Loading applications" size={"large"} />
          ) : query.isError ? null : (
            <Text color="textSecondary" align="center">
              {offline
                ? "No matching downloaded applications."
                : "No applications match your filters."}
            </Text>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <StyledActivityIndicator accessibilityLabel="Loading more applications" />
          ) : null
        }
      />
      {sheet === "filters" && (
        <ApplicationsFiltersSheet
          filters={filters}
          manager={manager}
          onApply={setFilters}
          onClose={closeSheet}
        />
      )}
      {sheet === "sort" && (
        <SelectableListBottomSheet
          title="Sort applications"
          items={applicationSortOptions}
          value={sort}
          resetValue="createdDesc"
          onApply={setSort}
          onClose={closeSheet}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerButtons: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  feedback: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
}));
