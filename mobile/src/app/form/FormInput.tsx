import { useCallback } from "react";
import type { TextInput } from "react-native";
import { Input, type InputProps } from "@/components/ui/Input";
import { useFieldContext } from "./form-context";
import { getErrorMessage } from "./getErrorMessage";
import type { RegisterInput } from "./useFormInputs";

export type FormInputProps = Omit<InputProps, "value" | "defaultValue" | "isError" | "ref"> & {
  registerInput?: RegisterInput;
};

export function FormInput({
  description,
  onChangeText,
  onBlur,
  registerInput,
  ...props
}: FormInputProps) {
  const field = useFieldContext<string>();
  const showError = !field.state.meta.isValid && field.state.meta.isTouched;
  const errorMessage = showError ? getErrorMessage(field.state.meta.errors) : undefined;
  const ref = useCallback(
    (input: TextInput | null) => registerInput?.(field.name, input),
    [field.name, registerInput],
  );

  return (
    <Input
      {...props}
      ref={ref}
      value={field.state.value}
      isError={showError}
      description={errorMessage ?? description}
      onChangeText={(value) => {
        field.handleChange(value);
        onChangeText?.(value);
      }}
      onBlur={(event) => {
        field.handleBlur();
        onBlur?.(event);
      }}
    />
  );
}
