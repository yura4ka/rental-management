import { InputPressable, type InputPressableProps } from "@/components/ui/Input";
import { useFieldContext } from "./form-context";
import { getErrorMessage } from "./getErrorMessage";

export type FormInputPressableProps = Omit<InputPressableProps, "value" | "isError"> & {
  formatValue?: (value: string) => string;
};

export function FormInputPressable({
  description,
  onBlur,
  formatValue,
  ...props
}: FormInputPressableProps) {
  const field = useFieldContext<string>();
  const showError = !field.state.meta.isValid && field.state.meta.isTouched;
  const errorMessage = showError ? getErrorMessage(field.state.meta.errors) : undefined;

  return (
    <InputPressable
      {...props}
      value={formatValue ? formatValue(field.state.value) : field.state.value}
      isError={showError}
      description={errorMessage ?? description}
      onBlur={(event) => {
        field.handleBlur();
        onBlur?.(event);
      }}
    />
  );
}
