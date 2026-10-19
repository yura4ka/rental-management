import { useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { uuidv7 } from "uuidv7";
import { toast } from "@/app/toast";
import { useAppForm, useFormInputs } from "@/app/form";
import { BottomSheet } from "@/components/BottomSheet";
import { Button, Text } from "@/components/ui";
import { getFieldErrors } from "@/shared/utils/errorUtils";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import { propertyFormSchema, toPropertyAddress, toPropertyForm } from "../forms";
import { useCreateProperty, useUpdateProperty } from "../hooks";
import type { PropertyDto } from "../types";

export function PropertyFormSheet({
  property,
  onClose,
}: {
  property?: PropertyDto;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const [snapshot] = useState(() => ({
    property,
    id: property?.id ?? uuidv7(),
    values: toPropertyForm(property),
  }));
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: snapshot.values,
    validators: { onChange: propertyFormSchema, onSubmit: propertyFormSchema },
    onSubmit: async ({ value, formApi }) => {
      if (pending) return;
      setError("");
      try {
        const address = toPropertyAddress(value);
        const result = snapshot.property
          ? await update.mutateAsync({
              id: snapshot.id,
              expectedVersion: snapshot.property.version,
              address,
            })
          : await create.mutateAsync({ id: snapshot.id, address });
        if (result.status === "Accepted") {
          toast.success("Property saved to server.");
          await sheet.current?.dismiss();
        } else setPending(true);
      } catch (error) {
        const fields = getFieldErrors(error, [
          "address.displayName",
          "address.streetAddress",
          "address.line2",
        ] as const);
        for (const name of [
          "address.displayName",
          "address.streetAddress",
          "address.line2",
        ] as const) {
          if (fields[name])
            formApi.setFieldMeta(name, (meta) => ({
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
    <form.AppForm>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(busy) => (
          <BottomSheet.Root ref={sheet}>
            <BottomSheet.Content scrollable dismissible={!busy} onDidDismiss={onClose}>
              <BottomSheet.Header
                title={snapshot.property ? "Edit property" : "Add property"}
                noCloseButton={busy}
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                <BottomSheet.Body>
                  <form.AppField name="address.displayName">
                    {(field) => (
                      <field.FormInput
                        label="Display name"
                        maxLength={100}
                        editable={!busy && !pending}
                        registerInput={registerInput}
                        returnKeyType="next"
                        onSubmitEditing={() => focusInput("address.streetAddress")}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="address.streetAddress">
                    {(field) => (
                      <field.FormInput
                        label="Street address (required)"
                        maxLength={200}
                        autoComplete="street-address"
                        editable={!busy && !pending}
                        registerInput={registerInput}
                        returnKeyType="next"
                        onSubmitEditing={() => focusInput("address.line2")}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="address.line2">
                    {(field) => (
                      <field.FormInput
                        label="Address line 2"
                        maxLength={100}
                        editable={!busy && !pending}
                        registerInput={registerInput}
                        returnKeyType="done"
                        onSubmitEditing={() => void form.handleSubmit()}
                      />
                    )}
                  </form.AppField>
                  {!!error && <Text accessibilityRole="alert">{error}</Text>}
                  {pending && (
                    <Text accessibilityLiveRegion="polite">
                      Pending sync. Your property has not been confirmed by the server.
                    </Text>
                  )}
                </BottomSheet.Body>
              </ScrollView>
              <BottomSheet.Footer>
                <Button
                  title={pending ? "Close" : "Cancel"}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void sheet.current?.dismiss()}
                />
                {!pending && <form.SubmitButton title="Save property" />}
              </BottomSheet.Footer>
            </BottomSheet.Content>
          </BottomSheet.Root>
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}
