import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { Text } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import type { AvailableUnitDto } from "../types";
import { formatMonthlyRent } from "../forms";

export function AvailableUnitCard({
  item,
  onPress,
}: {
  item: AvailableUnitDto;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress}>
      <Card.Root>
        <Card.Header title={getAddressDisplayName(item.property.address)} />
        <Card.Body style={styles.body}>
          <View style={styles.summary}>
            <Icon name="TIconBedOutline" size={18} />
            <Text accessibilityLabel={`${item.unit.bedrooms} bedrooms`}>{item.unit.bedrooms}</Text>
            <Text color="textSecondary">·</Text>
            <Text style={styles.type} numberOfLines={1}>
              {item.unitType.name}
            </Text>
          </View>
          <Text fontFamily="semibold">{formatMonthlyRent(item.unit.monthlyRentCents)}</Text>
        </Card.Body>
      </Card.Root>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    paddingTop: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  summary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  type: { flexShrink: 1 },
}));
