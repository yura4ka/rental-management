import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Routes } from "@/app/navigation/routes";
import type { BottomTabsScreenProps } from "@/app/navigation/types";
import { FilterButton } from "@/components/FilterButton";
import { SelectableListBottomSheet } from "@/components/SelectableListBottomSheet";
import { Button, Text } from "@/components/ui";
import { AvailableUnitCard } from "@/features/inventory/components/AvailableUnitCard";
import { AvailableUnitDetailsSheet } from "@/features/inventory/components/AvailableUnitDetailsSheet";
import { InventoryFiltersSheet } from "@/features/inventory/components/InventoryFiltersSheet";
import {
  defaultInventoryFilters,
  inventorySortOptions,
  toInventoryParams,
  toSortParams,
  type InventoryFilters,
  type InventorySort,
} from "@/features/inventory/forms";
import { useAvailableUnits } from "@/features/inventory/hooks";
import type { AvailableUnitDto } from "@/features/inventory/types";
import { FlatListLayout } from "@/components/layout";
import { StyledActivityIndicator } from "@/components";

type Sheet = { kind: "filters" } | { kind: "sort" } | { kind: "details"; item: AvailableUnitDto };

export function AvailableUnitsScreen({ navigation }: BottomTabsScreenProps<Routes.AvailableUnits>) {
  const [filters, setFilters] = useState<InventoryFilters>(defaultInventoryFilters);
  const [sort, setSort] = useState<InventorySort>("default");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const params = useMemo(
    () => ({ ...toInventoryParams(filters), ...toSortParams(sort) }),
    [filters, sort],
  );
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    refetch,
    fetchNextPage,
    isError,
    isRefetching,
    hasNextPage,
    isFetchNextPageError,
  } = useAvailableUnits(params);
  const pages = data?.pages;
  const items = useMemo(
    () => [
      ...new Map(
        (pages ?? []).flatMap((page) => page.data.items).map((item) => [item.unit.id, item]),
      ).values(),
    ],
    [pages],
  );
  const offline = pages?.some((page) => page.source === "device");
  const fallback = pages?.some((page) => page.fallbackError != null);
  const filtersActive =
    filters.unitTypeIds.length > 0 ||
    filters.bedrooms !== null ||
    filters.priceFrom.trim() !== "" ||
    filters.priceTo.trim() !== "";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <FilterButton
            icon="TIconAdjustmentsHorizontalOutline"
            accessibilityLabel="Filter units"
            isActive={filtersActive}
            disabled={sheet !== null}
            onPress={() => setSheet({ kind: "filters" })}
          />
          <FilterButton
            icon="TIconArrowsSortOutline"
            accessibilityLabel="Sort units"
            isActive={sort !== "default"}
            disabled={sheet !== null}
            onPress={() => setSheet({ kind: "sort" })}
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
        keyExtractor={(item) => item.unit.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AvailableUnitCard
            item={item}
            onPress={() => {
              if (!sheet) setSheet({ kind: "details", item });
            }}
          />
        )}
        refreshing={isRefetching && !isFetchingNextPage}
        onRefresh={() => void refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetching && !isError) void fetchNextPage();
        }}
        ListHeaderComponent={
          <>
            {offline && (
              <Text color="textSecondary">
                Showing offline data. Only previously downloaded records are included. Availability
                may have changed.
              </Text>
            )}
            {(isError || fallback) && (
              <View style={styles.feedback}>
                <Text>
                  {items.length
                    ? "Could not refresh available units."
                    : "Could not download available units."}
                </Text>
                <Button
                  title="Retry"
                  variant="textPrimary"
                  onPress={() => void (isFetchNextPageError ? fetchNextPage() : refetch())}
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <StyledActivityIndicator size="large" accessibilityLabel="Loading available units" />
          ) : isError ? null : (
            <Text color="textSecondary" align="center">
              {offline
                ? "No matching downloaded records"
                : "No available units match your filters."}
            </Text>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <StyledActivityIndicator accessibilityLabel="Loading more units" />
          ) : null
        }
      />
      {sheet?.kind === "details" && (
        <AvailableUnitDetailsSheet
          item={sheet.item}
          onClose={closeSheet}
          onApply={(unitId) => navigation.navigate(Routes.ApplicationForm, { unitId })}
        />
      )}
      {sheet?.kind === "filters" && (
        <InventoryFiltersSheet filters={filters} onApply={setFilters} onClose={closeSheet} />
      )}
      {sheet?.kind === "sort" && (
        <SelectableListBottomSheet
          title="Sort units"
          items={inventorySortOptions}
          value={sort}
          resetValue="default"
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
