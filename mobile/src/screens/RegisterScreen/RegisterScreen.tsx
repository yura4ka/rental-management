import { useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useAppForm, useFormInputs } from "@/app/form";
import { getErrorMessage } from "@/app/form/getErrorMessage";
import { Routes } from "@/app/navigation/routes";
import type { UnauthenticatedStackScreenProps } from "@/app/navigation/types";
import { toast } from "@/app/toast";
import { AuthCard } from "@/components/layout";
import { Button, Chip, Text } from "@/components/ui";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas";
import { useLogin, useRegister } from "@/features/auth/hooks";
import { getApiErrorMessage, getFieldErrors } from "@/shared/utils/errorUtils";

const defaultValues = {
  email: "",
  password: "",
  role: "Applicant",
} satisfies RegisterInput as RegisterInput;

export function RegisterScreen({ navigation }: UnauthenticatedStackScreenProps<Routes.Register>) {
  const register = useRegister();
  const login = useLogin();
  const [registered, setRegistered] = useState(false);
  const isPending = register.isPending || login.isPending;
  const form = useAppForm({
    defaultValues,
    validators: { onChange: registerSchema, onSubmit: registerSchema },
    onSubmit: async ({ value, formApi }) => {
      const input = { ...value, email: value.email.trim() };
      try {
        if (!registered) {
          await register.mutateAsync(input);
          setRegistered(true);
        }
        await login.mutateAsync({ email: input.email, password: input.password });
        toast.success("Account created. You’re logged in.");
      } catch (error) {
        if (error) toast.error(getApiErrorMessage(error));
        formApi.setErrorMap({
          onSubmit: { fields: getFieldErrors(error, ["email", "password", "role"]) },
        });
      }
    },
  });
  const { registerInput, focusInput } = useFormInputs<typeof form>();

  return (
    <AuthCard title="Create an account">
      <form.AppForm>
        {registered && <Text>Your account was created. Retry logging in below.</Text>}
        <form.AppField name="email">
          {(field) => (
            <field.FormInput
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isPending && !registered}
              registerInput={registerInput}
              returnKeyType="next"
              onSubmitEditing={() => focusInput("password")}
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.FormInput
              label="Password"
              description="12–128 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete={registered ? "current-password" : "new-password"}
              editable={!isPending}
              registerInput={registerInput}
              returnKeyType="done"
              onSubmitEditing={() => void form.handleSubmit()}
            />
          )}
        </form.AppField>
        <form.AppField name="role">
          {(field) => (
            <View style={styles.role}>
              <Text variant="label">Role</Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Account role"
                style={styles.chips}
              >
                <Chip
                  title="Applicant"
                  selected={field.state.value === "Applicant"}
                  disabled={isPending || registered}
                  onPress={() => {
                    field.handleChange("Applicant");
                    field.handleBlur();
                  }}
                />
                <Chip
                  title="Property Manager"
                  selected={field.state.value === "PropertyManager"}
                  disabled={isPending || registered}
                  onPress={() => {
                    field.handleChange("PropertyManager");
                    field.handleBlur();
                  }}
                />
              </View>
              {!field.state.meta.isValid && (
                <Text variant="supporting" color="danger.foreground">
                  {getErrorMessage(field.state.meta.errors)}
                </Text>
              )}
            </View>
          )}
        </form.AppField>
        <form.SubmitButton title={registered ? "Retry login" : "Register"} />
        <Button
          title="Already have an account? Log in"
          variant="textPrimary"
          disabled={isPending}
          onPress={() => navigation.navigate(Routes.Login)}
        />
      </form.AppForm>
    </AuthCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  role: { gap: theme.spacing.sm },
  chips: { flexDirection: "row", gap: theme.spacing.sm },
}));
