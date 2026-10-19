import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { withForm, useFormInputs } from "@/app/form";
import { Button, Text } from "@/components/ui";
import { AddressFields } from "@/features/address";
import { Card } from "@/components";
import { editorDefaults } from "../forms";

export const ApplicationInformationSection = withForm({
  defaultValues: editorDefaults(),
  props: {} as { disabled: boolean; onCopyProfile: () => void },
  render: function ApplicationInformationSection({ form, disabled, onCopyProfile }) {
    const { registerInput, focusInput } = useFormInputs<typeof form>();
    return (
      <Card.Root>
        <Card.Header border={true}>
          <View style={styles.header}>
            <Text variant="cardTitle" style={styles.title}>
              Applicant
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
          <Text variant="heading">Contact information</Text>
          <form.AppField name="applicantInformation.name">
            {(field) => (
              <field.FormInput
                label="Name"
                isRequired={true}
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
                isRequired={true}
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
                isRequired={true}
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
          <Text variant="heading">Current address</Text>
          <AddressFields
            form={form}
            fields="applicantInformation.currentAddress"
            disabled={disabled}
            streetRequired
          />
        </Card.Body>
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
}));
