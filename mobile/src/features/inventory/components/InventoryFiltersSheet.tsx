import { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { useAppForm, useFormInputs } from "@/app/form";
import { BottomSheet } from "@/components/BottomSheet";
import { Button, Text } from "@/components/ui";
import { Chip } from "@/components/ui/Chip";
import { defaultInventoryFilters, inventoryFiltersSchema, type InventoryFilters } from "../forms";
import { useUnitTypes } from "../hooks";

export function InventoryFiltersSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: InventoryFilters;
  onApply: (filters: InventoryFilters) => void;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const types = useUnitTypes();
  const form = useAppForm({
    defaultValues: filters,
    validators: { onChange: inventoryFiltersSchema, onSubmit: inventoryFiltersSchema },
    onSubmit: ({ value }) => {
      onApply(inventoryFiltersSchema.parse(value));
      void sheet.current?.dismiss();
    },
  });
  const { registerInput, focusInput } = useFormInputs<typeof form>();
  useEffect(() => {
    void sheet.current?.present();
  }, []);
  return (
    <form.AppForm>
      <BottomSheet.Root ref={sheet}>
        <BottomSheet.Content scrollable onDidDismiss={onClose}>
          <BottomSheet.Header title="Filters" border={true} />
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <BottomSheet.Body>
              <Text variant="heading">Unit types</Text>
              {types.isPending && <Text color="textSecondary">Loading unit types…</Text>}
              {types.isError && (
                <>
                  <Text>Unit types unavailable.</Text>
                  <Button
                    title="Retry unit types"
                    variant="textPrimary"
                    onPress={() => void types.refetch()}
                  />
                </>
              )}
              {types.data?.source === "device" && (
                <Text variant="supporting" color="textSecondary">
                  Showing downloaded unit types.
                </Text>
              )}
              {types.data?.fallbackError != null && (
                <Button
                  title="Retry unit types"
                  variant="textPrimary"
                  onPress={() => void types.refetch()}
                />
              )}
              <form.AppField name="unitTypeIds">
                {(field) => (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                  >
                    {(types.data?.data ?? []).map((type) => (
                      <Chip
                        key={type.id}
                        title={type.name}
                        selected={field.state.value.includes(type.id)}
                        accessibilityRole="checkbox"
                        onPress={() =>
                          field.handleChange(
                            field.state.value.includes(type.id)
                              ? field.state.value.filter((id) => id !== type.id)
                              : [...field.state.value, type.id],
                          )
                        }
                      />
                    ))}
                  </ScrollView>
                )}
              </form.AppField>
              <Text variant="heading">Number of bedrooms</Text>
              <form.AppField name="bedrooms">
                {(field) => (
                  <View style={styles.row}>
                    <Button
                      title="+"
                      variant="secondary"
                      accessibilityLabel="Increase bedrooms"
                      disabled={field.state.value === 10}
                      onPress={() =>
                        field.handleChange(field.state.value === null ? 1 : field.state.value + 1)
                      }
                    />
                    <Text accessibilityLiveRegion="polite" style={styles.count}>
                      {field.state.value ?? "Any"}
                    </Text>
                    <Button
                      title="−"
                      variant="secondary"
                      accessibilityLabel="Decrease bedrooms"
                      disabled={field.state.value === null || field.state.value === 1}
                      onPress={() => field.handleChange(Math.max(1, (field.state.value ?? 1) - 1))}
                    />
                    <Button
                      title="Any"
                      variant="textPrimary"
                      onPress={() => field.handleChange(null)}
                    />
                  </View>
                )}
              </form.AppField>
              <Text variant="heading">Price range</Text>
              <View style={styles.row}>
                <View style={styles.input}>
                  <form.AppField name="priceFrom">
                    {(field) => (
                      <field.FormInput
                        label="Price from (USD)"
                        keyboardType="decimal-pad"
                        registerInput={registerInput}
                        returnKeyType="next"
                        onSubmitEditing={() => focusInput("priceTo")}
                      />
                    )}
                  </form.AppField>
                </View>
                <View style={styles.input}>
                  <form.AppField name="priceTo">
                    {(field) => (
                      <field.FormInput
                        label="Price to (USD)"
                        keyboardType="decimal-pad"
                        registerInput={registerInput}
                        returnKeyType="done"
                        onSubmitEditing={() => void form.handleSubmit()}
                      />
                    )}
                  </form.AppField>
                </View>
              </View>
            </BottomSheet.Body>
          </ScrollView>
          <BottomSheet.Footer>
            <Button
              title="Reset"
              variant="textPrimary"
              onPress={() => form.reset(defaultInventoryFilters)}
            />
            <form.SubmitButton title="Show units" />
          </BottomSheet.Footer>
        </BottomSheet.Content>
      </BottomSheet.Root>
    </form.AppForm>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  chips: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  input: { flex: 1 },
  count: {
    minWidth: 40,
    textAlign: "center",
  },
}));
