# App forms

Import the hooks from `@/app/form`. `useAppForm` accepts the standard TanStack Form
options and binds the shared input and submit components.

```tsx
import { useAppForm, useFormInputs } from "@/app/form";

function LoginForm() {
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      // Await the request here so the submit button stays loading.
      await login(value);
    },
  });
  const { registerInput, focusInput } = useFormInputs<typeof form>();

  return (
    <form.AppForm>
      <form.AppField
        name="email"
        validators={{ onChange: ({ value }) => (!value ? "Email is required" : undefined) }}
      >
        {(field) => (
          <field.FormInput
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            registerInput={registerInput}
            returnKeyType="next"
            onSubmitEditing={() => focusInput("password")}
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.FormInput label="Password" secureTextEntry registerInput={registerInput} />
        )}
      </form.AppField>
      <form.SubmitButton title="Log in" />
    </form.AppForm>
  );
}
```

- Both field components bind string values and show current validation errors
  instead of `description`. String errors and Standard Schema issue messages are
  supported. Validation timing is controlled by your TanStack validators.
- `FormInput` binds change/blur handlers and also calls any supplied handlers.
  Pass `registerInput` directly; refs are removed when inputs unmount.
- `focusInput` accepts typed field paths, including nested paths, and safely does
  nothing if the input is not mounted.
- `FormInputPressable` keeps `onPress` customizable. Open your picker there and
  call `field.handleChange(selectedValue)` when a string value is selected. Call
  `field.handleBlur()` when the picker closes if native blur does not occur.
- `SubmitButton` requires `form.AppForm`. It blocks known field/form errors,
  pending validation, duplicate submissions, and an explicit `disabled` prop.
  Pressing it runs TanStack's submit validation before your `onSubmit` callback.
- `withForm`, `withFieldGroup`, `useFieldContext`, and `useFormContext` are also
  exported for composing additional shared form components.
