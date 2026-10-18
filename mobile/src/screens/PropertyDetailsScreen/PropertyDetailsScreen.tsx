import { useCallback, useLayoutEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { FilterButton } from "@/components/FilterButton";
import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { Button, Text } from "@/components/ui";
import { ArchivedFilterSheet } from "@/features/inventory/components/ArchivedFilterSheet";
import {
  InventoryManagementCard,
  ManagedInventoryList,
} from "@/features/inventory/components/ManagedInventoryList";
import { formatMonthlyRent } from "@/features/inventory/forms";
import { useUnitTypes } from "@/features/inventory/hooks";
import { PropertyFormSheet } from "@/features/properties/components/PropertyFormSheet";
import { useArchiveProperty, useProperty } from "@/features/properties/hooks";
import type { PropertyDto } from "@/features/properties/types";
import { UnitFormSheet } from "@/features/units/components/UnitFormSheet";
import { useUnits } from "@/features/units/hooks";
import type { UnitDto } from "@/features/units/types";

type Sheet =
  | { kind: "filters" }
  | { kind: "add" }
  | { kind: "edit" }
  | { kind: "archive"; property: PropertyDto }
  | { kind: "unit"; unit: UnitDto };

export function PropertyDetailsScreen({
  navigation,
  route,
}: AuthenticatedStackScreenProps<Routes.PropertyDetails>) {
  const { propertyId } = route.params;
  const propertyQuery = useProperty(propertyId);
  const property = propertyQuery.data?.data;
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const units = useUnits({ propertyId, includeArchived }, !!property);
  const types = useUnitTypes();
  const archive = useArchiveProperty();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Property details",
      headerRight: () => (
        <View style={styles.headerButtons}>
          <FilterButton
            icon="TIconAdjustmentsHorizontalOutline"
            accessibilityLabel="Filter property units"
            isActive={includeArchived}
            disabled={sheet !== null || !property}
            onPress={() => setSheet({ kind: "filters" })}
          />
          <FilterButton
            icon="TIconPlus"
            isActive={false}
            accessibilityLabel="Add unit"
            disabled={sheet !== null || !property || !!property.archivedAt}
            onPress={() => setSheet({ kind: "add" })}
          />
        </View>
      ),
    });
  }, [navigation, includeArchived, sheet, property]);

  if (!property)
    return (
      <View style={styles.feedback}>
        {propertyQuery.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading property" />
        ) : (
          <>
            <Text>
              {propertyQuery.error instanceof Error
                ? propertyQuery.error.message
                : "Property unavailable."}
            </Text>
            <Button title="Retry" onPress={() => void propertyQuery.refetch()} />
          </>
        )}
      </View>
    );

  return (
    <View style={styles.screen}>
      <ManagedInventoryList
        query={units}
        label="units"
        onRefresh={() => {
          void propertyQuery.refetch();
          void units.refetch();
        }}
        header={
          <>
            <Text variant="sectionHeading" fontFamily="semibold">
              {property.displayAddress}
            </Text>
            {!!property.archivedAt && (
              <Text color="textSecondary">Archived property. Its units are read-only.</Text>
            )}
            {propertyQuery.data?.source === "device" && (
              <Text color="textSecondary">Showing downloaded property details.</Text>
            )}
            {(propertyQuery.isError || propertyQuery.data?.fallbackError != null) && (
              <>
                <Text>Could not refresh property details.</Text>
                <Button
                  title="Retry property"
                  variant="textPrimary"
                  onPress={() => void propertyQuery.refetch()}
                />
              </>
            )}
          </>
        }
        renderItem={(item) => (
          <InventoryManagementCard
            title={`Unit ${item.number}`}
            description={`${types.data?.data.find((type) => type.id === item.unitTypeId)?.name ?? "Unit"} · ${item.bedrooms} bedrooms · ${formatMonthlyRent(item.monthlyRentCents)}`}
            archived={!!item.archivedAt || !!property.archivedAt}
            disabled={sheet !== null}
            onPress={() => setSheet({ kind: "unit", unit: item })}
          />
        )}
      />
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.footer}>
        <Button
          title="Edit property"
          variant="secondary"
          style={styles.action}
          disabled={sheet !== null || !!property.archivedAt}
          onPress={() => setSheet({ kind: "edit" })}
        />
        <Button
          title="Archive property"
          style={styles.action}
          disabled={sheet !== null || !!property.archivedAt}
          onPress={() => setSheet({ kind: "archive", property })}
        />
      </SafeAreaView>
      {sheet?.kind === "filters" && (
        <ArchivedFilterSheet
          includeArchived={includeArchived}
          onApply={setIncludeArchived}
          onClose={closeSheet}
        />
      )}
      {sheet?.kind === "edit" && <PropertyFormSheet property={property} onClose={closeSheet} />}
      {sheet?.kind === "archive" && (
        <ConfirmationBottomSheet
          title="Archive property?"
          message="Are you sure? All active units in this property will also be archived. This cannot be undone."
          onClose={closeSheet}
          onConfirm={() =>
            archive.mutateAsync({ id: sheet.property.id, expectedVersion: sheet.property.version })
          }
        />
      )}
      {(sheet?.kind === "add" || sheet?.kind === "unit") && (
        <UnitFormSheet
          property={property}
          unit={sheet.kind === "unit" ? sheet.unit : undefined}
          onClose={closeSheet}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1 },
  headerButtons: { flexDirection: "row", gap: theme.spacing.sm },
  feedback: { padding: theme.spacing.lg, gap: theme.spacing.md },
  footer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  action: { flex: 1 },
}));
