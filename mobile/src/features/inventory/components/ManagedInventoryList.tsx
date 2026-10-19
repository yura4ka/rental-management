import { useMemo, type ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { FlatListLayout } from "@/components/layout";
import { Button, Text } from "@/components/ui";
import type { InventoryPageDto } from "@/features/properties/types";
import { StyledActivityIndicator } from "@/components";
import type { InventoryRead } from "../inventoryService";

export function ManagedInventoryList<T extends { id: string }>({
  query,
  label,
  renderItem,
  header,
  onRefresh,
}: {
  query: UseInfiniteQueryResult<InfiniteData<InventoryRead<InventoryPageDto<T>>>, Error>;
  label: string;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
  onRefresh?: () => void;
}) {
  const pages = query.data?.pages;
  const items = useMemo(
    () => [
      ...new Map(
        (pages ?? []).flatMap((page) => page.data.items).map((item) => [item.id, item]),
      ).values(),
    ],
    [pages],
  );
  const offline = pages?.some((page) => page.source === "device");
  const fallback = pages?.some((page) => page.fallbackError != null);

  return (
    <FlatListLayout
      edges={["left", "right"]}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <>{renderItem(item)}</>}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={onRefresh ?? (() => void query.refetch())}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isError) void query.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={styles.feedback}>
          {header}
          {offline && (
            <Text color="textSecondary">
              Showing offline data. Only previously downloaded records are included.
            </Text>
          )}
          {(query.isError || fallback) && (
            <>
              <Text>Could not refresh {label}.</Text>
              <Button
                title="Retry"
                variant="textPrimary"
                onPress={() =>
                  void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                }
              />
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        query.isLoading ? (
          <StyledActivityIndicator size="large" accessibilityLabel={`Loading ${label}`} />
        ) : query.isError ? null : (
          <Text color="textSecondary" align="center">
            {offline ? "No matching downloaded records" : `No ${label} to show.`}
          </Text>
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <StyledActivityIndicator accessibilityLabel={`Loading more ${label}`} />
        ) : null
      }
    />
  );
}

export function InventoryManagementCard({
  title,
  description,
  archived,
  disabled,
  onPress,
}: {
  title: string;
  description?: string;
  archived?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={styles.card}
    >
      <Text fontFamily="semibold">{title}</Text>
      {!!description && <Text color="textSecondary">{description}</Text>}
      {archived && <Text color="textSecondary">Archived</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  feedback: {
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
    gap: theme.spacing.sm,
  },
}));
