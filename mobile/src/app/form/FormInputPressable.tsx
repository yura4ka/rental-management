import { InputPressable, type InputPressableProps } from "@/components/ui/Input";
import { useFieldContext } from "./form-context";
import { getErrorMessage } from "./getErrorMessage";

export type FormInputPressableProps = Omit<InputPressableProps, "value" | "isError">;

export function FormInputPressable({ description, onBlur, ...props }: FormInputPressableProps) {
  const field = useFieldContext<string>();
  const errorMessage = getErrorMessage(field.state.meta.errors);

  return (
    <InputPressable
      {...props}
      value={field.state.value}
      isError={!field.state.meta.isValid}
      description={errorMessage ?? description}
      onBlur={(event) => {
        field.handleBlur();
        onBlur?.(event);
      }}
    />
  );
}
