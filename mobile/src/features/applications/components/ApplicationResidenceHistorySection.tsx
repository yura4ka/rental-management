import { useRef, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { withForm } from "@/app/form";
import { Button, Text } from "@/components/ui";
import { AddressFields } from "@/features/address";
import {
  DatePickerBottomSheet,
  type DatePickerBottomSheetRef,
} from "@/components/DatePickerBottomSheet";
import { toResidenceFormInput } from "@/features/applicantProfile/forms/utils";
import { formatCalendarDate } from "@/shared/utils/calendarDate";
import { Card } from "@/components";
import { editorDefaults } from "../forms";

export const ApplicationResidenceHistorySection = withForm({
  defaultValues: editorDefaults(),
  props: {} as { disabled: boolean; onCopyProfile: () => void },
  render: function ApplicationResidenceHistorySection({ form, disabled, onCopyProfile }) {
    const datePicker = useRef<DatePickerBottomSheetRef>(null);
    const nextKey = useRef(form.state.values.residenceHistory.length);
    const [keys, setKeys] = useState(() =>
      form.state.values.residenceHistory.map((_, index) => index),
    );
    return (
      <Card.Root>
        <Card.Header border={true}>
          <View style={styles.header}>
            <Text variant="cardTitle" style={styles.title}>
              Residence History
            </Text>
            <Button
              title="Copy from profile"
              size={"sm"}
              variant="textPrimary"
              disabled={disabled}
              onPress={onCopyProfile}
            />
          </View>
        </Card.Header>
        <Card.Body>
          <form.AppField name="residenceHistory" mode="array">
            {(arrayField) => (
              <>
                {!arrayField.state.value.length && (
                  <Text color="textSecondary">
                    No past residences. Continue to save an empty history.
                  </Text>
                )}
                {arrayField.state.value.map((_, index) => (
                  <View key={keys[index]} style={styles.residence}>
                    <Text variant="cardTitle">Residence {index + 1}</Text>
                    <Button
                      title="Delete"
                      accessibilityLabel={`Delete residence ${index + 1}`}
                      variant="text"
                      disabled={disabled}
                      onPress={() => {
                        arrayField.removeValue(index);
                        setKeys((current) => current.filter((_, i) => i !== index));
                      }}
                    />
                    <AddressFields
                      form={form}
                      fields={`residenceHistory[${index}].address`}
                      disabled={disabled}
                      streetRequired
                    />
                    <form.AppField name={`residenceHistory[${index}].landlordName`}>
                      {(field) => (
                        <field.FormInput
                          label="Landlord name"
                          maxLength={100}
                          editable={!disabled}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`residenceHistory[${index}].landlordPhone`}>
                      {(field) => (
                        <field.FormInput
                          label="Landlord phone"
                          description="NNN-NNN-NNNN"
                          keyboardType="phone-pad"
                          maxLength={50}
                          editable={!disabled}
                        />
                      )}
                    </form.AppField>
                    {(["moveInDate", "moveOutDate"] as const).map((name) => (
                      <form.AppField key={name} name={`residenceHistory[${index}].${name}`}>
                        {(field) => (
                          <field.FormInputPressable
                            label={name === "moveInDate" ? "Move-in date" : "Move-out date"}
                            formatValue={formatCalendarDate}
                            disabled={disabled}
                            onPress={() =>
                              datePicker.current?.open({
                                title: name === "moveInDate" ? "Move-in date" : "Move-out date",
                                value: field.state.value,
                                onConfirm: (date) => {
                                  field.handleChange(date);
                                  field.handleBlur();
                                },
                              })
                            }
                          />
                        )}
                      </form.AppField>
                    ))}
                  </View>
                ))}
                <Button
                  title="Add residence"
                  iconLeft="TIconPlus"
                  variant="textPrimary"
                  disabled={disabled}
                  onPress={() => {
                    const key = nextKey.current++;
                    setKeys((current) => [...current, key]);
                    arrayField.pushValue(toResidenceFormInput());
                  }}
                />
              </>
            )}
          </form.AppField>
        </Card.Body>
        <DatePickerBottomSheet ref={datePicker} />
      </Card.Root>
    );
  },
});

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  residence: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: theme.borderWidth.default,
    borderBottomColor: theme.colors.border,
  },
}));
