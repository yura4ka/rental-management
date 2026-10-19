import { StyleSheet } from "react-native-unistyles";
import { View } from "react-native";
import { useAppForm, useFormInputs } from "@/app/form";
import { Routes } from "@/app/navigation/routes";
import type { UnauthenticatedStackScreenProps } from "@/app/navigation/types";
import { toast } from "@/app/toast";
import { AuthCard } from "@/components/layout";
import { Button } from "@/components/ui";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { useLogin } from "@/features/auth/hooks";
import { getApiErrorMessage, getFieldErrors } from "@/shared/utils/errorUtils";

const defaultValues = { email: "", password: "" } satisfies LoginInput as LoginInput;

export function LoginScreen({ navigation }: UnauthenticatedStackScreenProps<Routes.Login>) {
  const login = useLogin();
  const form = useAppForm({
    defaultValues,
    validators: { onBlur: loginSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await login.mutateAsync({ ...value, email: value.email.trim() });
      } catch (error) {
        if (error) toast.error(getApiErrorMessage(error));
        formApi.setErrorMap({ onSubmit: { fields: getFieldErrors(error, ["email", "password"]) } });
      }
    },
  });
  const { registerInput, focusInput } = useFormInputs<typeof form>();

  return (
    <AuthCard title="Log in">
      <form.AppForm>
        <form.AppField name="email">
          {(field) => (
            <field.FormInput
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!login.isPending}
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
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!login.isPending}
              registerInput={registerInput}
              returnKeyType="done"
              onSubmitEditing={() => void form.handleSubmit()}
            />
          )}
        </form.AppField>
        <View style={styles.buttons}>
          <form.SubmitButton title="Log in" />
          <Button
            title="Create an account"
            variant="textPrimary"
            disabled={login.isPending}
            onPress={() => navigation.navigate(Routes.Register)}
          />
        </View>
      </form.AppForm>
    </AuthCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  buttons: {
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
}));
