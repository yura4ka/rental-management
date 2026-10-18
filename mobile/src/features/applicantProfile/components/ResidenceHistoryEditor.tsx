import { useRef, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { useAppForm } from "@/app/form";
import { toast } from "@/app/toast";
import {
  DatePickerBottomSheet,
  type DatePickerBottomSheetRef,
} from "@/components/DatePickerBottomSheet";
import { Button, Text } from "@/components/ui";
import { AddressFields, toAddress } from "@/features/address";
import { formatCalendarDate } from "@/shared/utils/calendarDate";
import { getApiErrorMessage, getFieldErrors } from "@/shared/utils/errorUtils";
import { residencesFormSchema, type ResidencesFormInput } from "../forms/schemas";
import { toResidenceFormInput } from "../forms/utils";
import { useUpdateResidenceHistory } from "../hooks";
import type { GetApplicantProfileResponse } from "../types";
import { ProfileEditorSheet } from "./ProfileEditorSheet";

type Props = { profile: GetApplicantProfileResponse; onClose: () => void };

export function ResidenceHistoryEditor({ profile, onClose }: Props) {
  const sheet = useRef<TrueSheet>(null);
  const datePicker = useRef<DatePickerBottomSheetRef>(null);
  const mutation = useUpdateResidenceHistory();
  const [pending, setPending] = useState(false);
  // Stable UI keys are separate from positional server DTOs and never sent to the API.
  const nextKey = useRef(profile.residenceHistory.length);
  const [keys, setKeys] = useState(() => profile.residenceHistory.map((_, index) => index));
  const defaultValues: ResidencesFormInput = {
    residenceHistory: profile.residenceHistory.map(toResidenceFormInput),
  };
  const form = useAppForm({
    defaultValues,
    validators: { onChange: residencesFormSchema, onSubmit: residencesFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const valid = residencesFormSchema.parse(value);
        const result = await mutation.mutateAsync({
          input: {
            expectedVersion: profile.version,
            residenceHistory: valid.residenceHistory.map((row) => ({
              ...row,
              address: toAddress(row.address),
            })),
          },
        });
        if (result.status === "Pending") {
          setPending(true);
        } else {
          toast.success("Past residences saved to server.");
          await sheet.current?.dismiss();
        }
      } catch (error) {
        const fields = value.residenceHistory.flatMap(
          (_, index) =>
            [
              `residenceHistory[${index}].address.displayName`,
              `residenceHistory[${index}].address.streetAddress`,
              `residenceHistory[${index}].address.line2`,
              `residenceHistory[${index}].landlordName`,
              `residenceHistory[${index}].landlordPhone`,
              `residenceHistory[${index}].moveInDate`,
              `residenceHistory[${index}].moveOutDate`,
            ] as const,
        );
        formApi.setErrorMap({ onSubmit: { fields: getFieldErrors(error, fields) } });
        toast.error(
          getApiErrorMessage(error) === "Unknown error" && error instanceof Error
            ? error.message
            : getApiErrorMessage(error),
        );
      }
    },
  });
  const disabled = mutation.isPending || pending;

  return (
    <form.AppForm>
      <ProfileEditorSheet
        sheetRef={sheet}
        title="Edit past residences"
        busy={mutation.isPending}
        onClose={onClose}
        footer={
          pending ? (
            <Button title="Close" onPress={() => void sheet.current?.dismiss()} />
          ) : (
            <form.SubmitButton title="Save residences" />
          )
        }
      >
        {pending && (
          <Text color="info.foreground">
            Pending sync — saved on this device, not yet confirmed by the server.
          </Text>
        )}
        <form.AppField name="residenceHistory" mode="array">
          {(arrayField) => (
            <>
              {arrayField.state.value.length === 0 && (
                <Text color="textSecondary">No past residences.</Text>
              )}
              {arrayField.state.value.map((_, index) => (
                <View key={keys[index]} style={styles.residence}>
                  <View style={styles.header}>
                    <Text variant="cardTitle" style={styles.title}>
                      Residence {index + 1}
                    </Text>
                    <Button
                      title="Delete"
                      accessibilityLabel={`Delete residence ${index + 1}`}
                      variant="text"
                      size="sm"
                      disabled={disabled}
                      onPress={() => {
                        arrayField.removeValue(index);
                        setKeys((current) => current.filter((_, i) => i !== index));
                      }}
                    />
                  </View>
                  <AddressFields
                    form={form}
                    fields={`residenceHistory[${index}].address`}
                    disabled={disabled}
                    streetRequired
                  />
                  <form.AppField name={`residenceHistory[${index}].landlordName`}>
                    {(field) => (
                      <field.FormInput label="Landlord name" maxLength={100} editable={!disabled} />
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
        <DatePickerBottomSheet ref={datePicker} />
      </ProfileEditorSheet>
    </form.AppForm>
  );
}

const styles = StyleSheet.create((theme) => ({
  residence: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: theme.borderWidth.default,
    borderBottomColor: theme.colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { flex: 1 },
}));
