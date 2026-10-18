import { useRef, useState } from "react";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { useAppForm, useFormInputs } from "@/app/form";
import { toast } from "@/app/toast";
import { Button, Text } from "@/components/ui";
import { AddressFields } from "@/features/address";
import { getApiErrorMessage, getFieldErrors } from "@/shared/utils/errorUtils";
import { profileFormSchema } from "../forms/schemas";
import { toApplicantInformation, toProfileFormInput } from "../forms/utils";
import { useUpdateApplicantInformation } from "../hooks";
import type { GetApplicantProfileResponse } from "../types";
import { ProfileEditorSheet } from "./ProfileEditorSheet";

type Props = { profile: GetApplicantProfileResponse; onClose: () => void };

export function ProfileInformationEditor({ profile, onClose }: Props) {
  const sheet = useRef<TrueSheet>(null);
  const mutation = useUpdateApplicantInformation();
  const [pending, setPending] = useState(false);
  const form = useAppForm({
    defaultValues: toProfileFormInput(profile.applicantInformation),
    validators: { onChange: profileFormSchema, onSubmit: profileFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await mutation.mutateAsync({
          input: {
            expectedVersion: profile.version,
            applicantInformation: toApplicantInformation(profileFormSchema.parse(value)),
          },
        });
        if (result.status === "Pending") {
          setPending(true);
        } else {
          toast.success("Profile saved to server.");
          await sheet.current?.dismiss();
        }
      } catch (error) {
        const errors = getFieldErrors(error, [
          "applicantInformation.name",
          "applicantInformation.phone",
          "applicantInformation.contactEmail",
          "applicantInformation.currentAddress.displayName",
          "applicantInformation.currentAddress.streetAddress",
          "applicantInformation.currentAddress.line2",
        ] as const);
        formApi.setErrorMap({
          onSubmit: {
            fields: {
              name: errors["applicantInformation.name"],
              phone: errors["applicantInformation.phone"],
              contactEmail: errors["applicantInformation.contactEmail"],
              "currentAddress.displayName":
                errors["applicantInformation.currentAddress.displayName"],
              "currentAddress.streetAddress":
                errors["applicantInformation.currentAddress.streetAddress"],
              "currentAddress.line2": errors["applicantInformation.currentAddress.line2"],
            },
          },
        });
        toast.error(
          getApiErrorMessage(error) === "Unknown error" && error instanceof Error
            ? error.message
            : getApiErrorMessage(error),
        );
      }
    },
  });
  const { registerInput, focusInput } = useFormInputs<typeof form>();
  const disabled = mutation.isPending || pending;

  return (
    <form.AppForm>
      <ProfileEditorSheet
        sheetRef={sheet}
        title="Edit profile"
        busy={mutation.isPending}
        onClose={onClose}
        footer={
          pending ? (
            <Button title="Close" onPress={() => void sheet.current?.dismiss()} />
          ) : (
            <form.SubmitButton title="Save profile" />
          )
        }
      >
        {pending && (
          <Text color="info.foreground">
            Pending sync — saved on this device, not yet confirmed by the server.
          </Text>
        )}
        <form.AppField name="name">
          {(field) => (
            <field.FormInput
              label="Name"
              autoComplete="name"
              maxLength={100}
              editable={!disabled}
              registerInput={registerInput}
              returnKeyType="next"
              onSubmitEditing={() => focusInput("phone")}
            />
          )}
        </form.AppField>
        <form.AppField name="phone">
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
        <form.AppField name="contactEmail">
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
            />
          )}
        </form.AppField>
        <Text variant="sectionHeading">Current address</Text>
        <AddressFields form={form} fields="currentAddress" disabled={disabled} />
      </ProfileEditorSheet>
    </form.AppForm>
  );
}
