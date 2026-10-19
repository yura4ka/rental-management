import { withFieldGroup } from "@/app/form";
import { toAddressInput } from "../utils";

export const AddressFields = withFieldGroup({
  defaultValues: toAddressInput(),
  props: {} as { disabled?: boolean; streetRequired?: boolean },
  render: function AddressFields({ group, disabled = false, streetRequired = false }) {
    return (
      <>
        <group.AppField name="displayName">
          {(field) => <field.FormInput label="Address name" maxLength={100} editable={!disabled} />}
        </group.AppField>
        <group.AppField name="streetAddress">
          {(field) => (
            <field.FormInput
              label={"Street address"}
              isRequired={streetRequired}
              autoComplete="street-address"
              maxLength={200}
              editable={!disabled}
            />
          )}
        </group.AppField>
        <group.AppField name="line2">
          {(field) => (
            <field.FormInput label="Address line 2" maxLength={100} editable={!disabled} />
          )}
        </group.AppField>
      </>
    );
  },
});
