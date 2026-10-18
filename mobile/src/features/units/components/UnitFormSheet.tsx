import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { uuidv7 } from "uuidv7";
import { toast } from "sonner-native";
import { useAppForm, useFormInputs } from "@/app/form";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { Button, Text } from "@/components/ui";
import { Chip } from "@/components/ui/Chip";
import { useUnitTypes } from "@/features/inventory/hooks";
import type { PropertyDto } from "@/features/properties/types";
import { getFieldErrors } from "@/shared/utils/errorUtils";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import { toUnitFields, toUnitForm, unitFormSchema } from "../forms";
import { useArchiveUnit, useCreateUnit, useUpdateUnit } from "../hooks";
import type { UnitDto } from "../types";

export function UnitFormSheet({
  property,
  unit,
  onClose,
}: {
  property: PropertyDto;
  unit?: UnitDto;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const archived = useRef(false);
  const [snapshot] = useState(() => ({ unit, id: unit?.id ?? uuidv7(), values: toUnitForm(unit) }));
  const create = useCreateUnit();
  const update = useUpdateUnit();
  const archive = useArchiveUnit();
  const types = useUnitTypes();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const readOnly = !!property.archivedAt || !!snapshot.unit?.archivedAt;
  const form = useAppForm({
    defaultValues: snapshot.values,
    validators: { onChange: unitFormSchema, onSubmit: unitFormSchema },
    onSubmit: async ({ value, formApi }) => {
      if (pending || readOnly || confirming) return;
      setError("");
      try {
        const fields = toUnitFields(value);
        const selected = types.data?.data.find((type) => type.id === fields.unitTypeId);
        if (fields.unitTypeId !== snapshot.unit?.unitTypeId && !selected?.isActive) {
          formApi.setFieldMeta("unitTypeId", (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onSubmit: "Choose an active unit type." },
          }));
          return;
        }
        const result = snapshot.unit
          ? await update.mutateAsync({
              ...fields,
              id: snapshot.id,
              propertyId: property.id,
              expectedVersion: snapshot.unit.version,
            })
          : await create.mutateAsync({ ...fields, id: snapshot.id, propertyId: property.id });
        if (result.status === "Accepted") {
          toast.success("Unit saved to server.");
          await sheet.current?.dismiss();
        } else setPending(true);
      } catch (error) {
        const fields = getFieldErrors(error, [
          "number",
          "unitTypeId",
          "bedrooms",
          "monthlyRentCents",
        ] as const);
        for (const name of ["number", "unitTypeId", "bedrooms", "monthlyRentCents"] as const) {
          const path = name === "monthlyRentCents" ? "monthlyRent" : name;
          if (fields[name])
            formApi.setFieldMeta(path, (meta) => ({
              ...meta,
              errorMap: { ...meta.errorMap, onSubmit: fields[name] },
            }));
        }
        setError(getOperationErrorMessage(error));
      }
    },
  });
  const { registerInput, focusInput } = useFormInputs<typeof form>();
  useEffect(() => {
    void sheet.current?.present();
  }, []);

  return (
    <>
      <form.AppForm>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <BottomSheet.Root ref={sheet}>
              <BottomSheet.Content
                scrollable
                dismissible={!busy && !confirming}
                onDidDismiss={onClose}
              >
                <BottomSheet.Header
                  title={readOnly ? "Unit details" : snapshot.unit ? "Edit unit" : "Add unit"}
                  noCloseButton={busy || confirming}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                  <BottomSheet.Body>
                    {readOnly && (
                      <Text color="textSecondary">Archived inventory is read-only.</Text>
                    )}
                    <form.AppField name="number">
                      {(field) => (
                        <field.FormInput
                          label="Unit number"
                          maxLength={20}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          editable={!busy && !pending && !readOnly && !confirming}
                          registerInput={registerInput}
                          returnKeyType="next"
                          onSubmitEditing={() => focusInput("monthlyRent")}
                        />
                      )}
                    </form.AppField>
                    <Text fontFamily="semibold">Unit type</Text>
                    {types.isPending && <Text color="textSecondary">Loading unit types…</Text>}
                    {types.isError && <Text>Unit types unavailable.</Text>}
                    {(types.isError || types.data?.fallbackError != null) && (
                      <Button
                        title="Retry unit types"
                        variant="textPrimary"
                        onPress={() => void types.refetch()}
                      />
                    )}
                    {types.data?.source === "device" && (
                      <Text color="textSecondary">Showing downloaded unit types.</Text>
                    )}
                    <form.AppField name="unitTypeId">
                      {(field) => (
                        <>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.row}
                          >
                            {(types.data?.data ?? [])
                              .filter(
                                (type) => type.isActive || type.id === snapshot.unit?.unitTypeId,
                              )
                              .map((type) => (
                                <Chip
                                  key={type.id}
                                  title={`${type.name}${type.isActive ? "" : " (inactive)"}`}
                                  selected={field.state.value === type.id}
                                  accessibilityRole="radio"
                                  disabled={busy || pending || readOnly || confirming}
                                  onPress={() => {
                                    field.handleChange(type.id);
                                    field.handleBlur();
                                  }}
                                />
                              ))}
                          </ScrollView>
                          {snapshot.unit &&
                            !types.data?.data.some(
                              (type) => type.id === snapshot.unit?.unitTypeId,
                            ) && (
                              <Text color="textSecondary">
                                Current type: {snapshot.unit.unitTypeId}
                              </Text>
                            )}
                          {field.state.meta.errors.length > 0 && (
                            <Text accessibilityRole="alert">Choose an active unit type.</Text>
                          )}
                        </>
                      )}
                    </form.AppField>
                    <Text fontFamily="semibold">Number of bedrooms</Text>
                    <form.AppField name="bedrooms">
                      {(field) => (
                        <View style={styles.row}>
                          <Button
                            title="+"
                            variant="secondary"
                            accessibilityLabel="Increase bedrooms"
                            disabled={
                              busy ||
                              pending ||
                              readOnly ||
                              confirming ||
                              field.state.value >= 2147483647
                            }
                            onPress={() => field.handleChange(field.state.value + 1)}
                          />
                          <Text accessibilityLiveRegion="polite">{field.state.value}</Text>
                          <Button
                            title="−"
                            variant="secondary"
                            accessibilityLabel="Decrease bedrooms"
                            disabled={
                              busy || pending || readOnly || confirming || field.state.value === 0
                            }
                            onPress={() => field.handleChange(field.state.value - 1)}
                          />
                        </View>
                      )}
                    </form.AppField>
                    <form.AppField name="monthlyRent">
                      {(field) => (
                        <field.FormInput
                          label="Monthly rent (USD)"
                          keyboardType="decimal-pad"
                          editable={!busy && !pending && !readOnly && !confirming}
                          registerInput={registerInput}
                          returnKeyType="done"
                          onSubmitEditing={() => void form.handleSubmit()}
                        />
                      )}
                    </form.AppField>
                    {!!error && <Text accessibilityRole="alert">{error}</Text>}
                    {pending && (
                      <Text accessibilityLiveRegion="polite">
                        Pending sync. Your unit has not been confirmed by the server.
                      </Text>
                    )}
                    {snapshot.unit && !readOnly && !pending && (
                      <Button
                        title="Archive unit"
                        variant="textPrimary"
                        disabled={busy || confirming}
                        onPress={() => setConfirming(true)}
                      />
                    )}
                  </BottomSheet.Body>
                </ScrollView>
                <BottomSheet.Footer>
                  <Button
                    title={pending || readOnly ? "Close" : "Cancel"}
                    variant="secondary"
                    disabled={busy || confirming}
                    onPress={() => void sheet.current?.dismiss()}
                  />
                  {!pending && !readOnly && (
                    <form.SubmitButton title="Save unit" disabled={confirming} />
                  )}
                </BottomSheet.Footer>
              </BottomSheet.Content>
            </BottomSheet.Root>
          )}
        </form.Subscribe>
      </form.AppForm>
      {confirming && snapshot.unit && (
        <ConfirmationBottomSheet
          title="Archive unit?"
          message={`Are you sure you want to archive unit ${snapshot.unit.number}? This cannot be undone.`}
          onClose={() => {
            setConfirming(false);
            if (archived.current) void sheet.current?.dismiss();
          }}
          onConfirm={async () => {
            const result = await archive.mutateAsync({
              propertyId: property.id,
              id: snapshot.id,
              expectedVersion: snapshot.unit!.version,
            });
            if (result.status === "Accepted") archived.current = true;
            else setPending(true);
            return result;
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
}));
