import { useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";
import { Button } from "@/components/ui";
import { SelectableList } from "@/components/SelectableList/SelectableList";

export type SelectableListBottomSheetProps<Value extends string | number> = {
  title: string;
  items: readonly { label: string; value: Value }[];
  value: Value;
  resetValue: Value;
  onApply: (value: Value) => void;
  onClose: () => void;
};

export function SelectableListBottomSheet<Value extends string | number>({
  title,
  items,
  value,
  resetValue,
  onApply,
  onClose,
}: SelectableListBottomSheetProps<Value>) {
  const sheet = useRef<TrueSheet>(null);
  const [selectedValue, setSelectedValue] = useState(value);
  useEffect(() => {
    void sheet.current?.present();
  }, []);
  return (
    <BottomSheet.Root ref={sheet}>
      <BottomSheet.Content scrollable onDidDismiss={onClose}>
        <BottomSheet.Header title={title} border={true} />
        <ScrollView>
          <BottomSheet.Body>
            <SelectableList items={items} value={selectedValue} onChange={setSelectedValue} />
          </BottomSheet.Body>
        </ScrollView>
        <BottomSheet.Footer>
          <Button
            title="Reset"
            variant="textPrimary"
            onPress={() => setSelectedValue(resetValue)}
          />
          <Button
            title="Apply"
            style={styles.apply}
            onPress={() => {
              onApply(selectedValue);
              void sheet.current?.dismiss();
            }}
          />
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}

const styles = StyleSheet.create((theme) => ({
  apply: { flex: 1 },
}));
