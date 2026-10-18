import { useEffect, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";
import { Button, Text } from "@/components/ui";

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
        <BottomSheet.Header title={title} />
        <ScrollView>
          <BottomSheet.Body>
            {items.map((item) => {
              const selected = item.value === selectedValue;
              return (
                <TouchableOpacity
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.item, selected && styles.selected]}
                  onPress={() => setSelectedValue(item.value)}
                >
                  <View style={[styles.radio, selected && styles.selected]}>
                    {selected && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.label}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
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
  item: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.control,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.border,
  },
  selected: {
    borderColor: theme.colors.primary,
    outlineColor: theme.colors.primary,
    outlineWidth: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.default,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  label: { flex: 1 },
  apply: { flex: 1 },
}));
