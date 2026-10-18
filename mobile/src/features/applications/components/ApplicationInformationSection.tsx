import { withForm, useFormInputs } from "@/app/form";
import { Button, Text } from "@/components/ui";
import { AddressFields } from "@/features/address";
import { editorDefaults } from "../forms";

export const ApplicationInformationSection = withForm({
  defaultValues: editorDefaults(),
  props: {} as { disabled: boolean; onCopyProfile: () => void },
  render: function ApplicationInformationSection({ form, disabled, onCopyProfile }) {
    const { registerInput, focusInput } = useFormInputs<typeof form>();
    return (
      <>
        <Text variant="sectionHeading">Applicant information</Text>
        <Button
          title="Copy from profile"
          variant="textPrimary"
          disabled={disabled}
          onPress={onCopyProfile}
        />
        <form.AppField name="applicantInformation.name">
          {(field) => (
            <field.FormInput
              label="Name"
              autoComplete="name"
              maxLength={100}
              editable={!disabled}
              registerInput={registerInput}
              returnKeyType="next"
              onSubmitEditing={() => focusInput("applicantInformation.phone")}
            />
          )}
        </form.AppField>
        <form.AppField name="applicantInformation.phone">
          {(field) => (
            <field.FormInput
              label="Phone"
              description="NNN-NNN-NNNN"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={50}
              editable={!disabled}
              registerInput={registerInput}
            />
          )}
        </form.AppField>
        <form.AppField name="applicantInformation.contactEmail">
          {(field) => (
            <field.FormInput
              label="Contact email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              maxLength={254}
              editable={!disabled}
              registerInput={registerInput}
              returnKeyType="next"
            />
          )}
        </form.AppField>
        <Text variant="sectionHeading">Current address</Text>
        <AddressFields
          form={form}
          fields="applicantInformation.currentAddress"
          disabled={disabled}
          streetRequired
        />
      </>
    );
  },
});
