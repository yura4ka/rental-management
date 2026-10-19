import { useCallback, useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Routes } from "@/app/navigation/routes";
import type { BottomTabsScreenProps } from "@/app/navigation/types";
import { FilterButton } from "@/components/FilterButton";
import { ArchivedFilterSheet } from "@/features/inventory/components/ArchivedFilterSheet";
import {
  InventoryManagementCard,
  ManagedInventoryList,
} from "@/features/inventory/components/ManagedInventoryList";
import { PropertyFormSheet } from "@/features/properties/components/PropertyFormSheet";
import { useProperties } from "@/features/properties/hooks";

export function MyPropertiesScreen({ navigation }: BottomTabsScreenProps<Routes.MyProperties>) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sheet, setSheet] = useState<"filters" | "add" | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const query = useProperties({ includeArchived });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <FilterButton
            icon="TIconAdjustmentsHorizontalOutline"
            accessibilityLabel="Filter properties"
            isActive={includeArchived}
            disabled={sheet !== null}
            onPress={() => setSheet("filters")}
          />
          <FilterButton
            icon="TIconPlus"
            isActive={false}
            accessibilityLabel="Add property"
            disabled={sheet !== null}
            onPress={() => setSheet("add")}
          />
        </View>
      ),
    });
  }, [navigation, includeArchived, sheet]);

  return (
    <>
      <ManagedInventoryList
        query={query}
        label="properties"
        renderItem={(item) => (
          <InventoryManagementCard
            title={item.displayAddress}
            archived={!!item.archivedAt}
            disabled={sheet !== null}
            onPress={() => navigation.navigate(Routes.PropertyDetails, { propertyId: item.id })}
          />
        )}
      />
      {sheet === "filters" && (
        <ArchivedFilterSheet
          includeArchived={includeArchived}
          onApply={setIncludeArchived}
          onClose={closeSheet}
        />
      )}
      {sheet === "add" && <PropertyFormSheet onClose={closeSheet} />}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  headerButtons: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
}));
