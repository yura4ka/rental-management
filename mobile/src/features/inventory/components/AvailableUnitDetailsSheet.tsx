import { useEffect, useRef } from "react";
import { ScrollView } from "react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";
import { LabelValue } from "@/components/LabelValue";
import { Button } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import { formatMonthlyRent } from "../forms";
import type { AvailableUnitDto } from "../types";

export function AvailableUnitDetailsSheet({
  item,
  onClose,
  onApply,
}: {
  item: AvailableUnitDto;
  onClose: () => void;
  onApply: (unitId: string) => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const applying = useRef(false);
  useEffect(() => {
    void sheet.current?.present();
  }, []);
  return (
    <BottomSheet.Root ref={sheet}>
      <BottomSheet.Content
        scrollable
        onDidDismiss={() => {
          onClose();
          if (applying.current) onApply(item.unit.id);
        }}
      >
        <BottomSheet.Header title="Unit details" />
        <ScrollView>
          <BottomSheet.Body>
            <LabelValue
              items={[
                { label: "Property", value: getAddressDisplayName(item.property.address) },
                { label: "Unit", value: item.unit.number },
                { label: "Bedrooms", value: String(item.unit.bedrooms) },
                { label: "Unit type", value: item.unitType.name },
                { label: "Monthly rent", value: formatMonthlyRent(item.unit.monthlyRentCents) },
              ]}
            />
          </BottomSheet.Body>
        </ScrollView>
        <BottomSheet.Footer>
          <Button
            title="Apply"
            style={{ flex: 1 }}
            onPress={() => {
              applying.current = true;
              void sheet.current?.dismiss();
            }}
          />
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}
