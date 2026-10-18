import { useCallback, useRef } from "react";
import type { TextInput } from "react-native";
import type { AnyFormApi, DeepKeys } from "@tanstack/react-form";

// Registration accepts runtime field names from the shared field context.
// The public focusInput function is restricted to the form's field paths.
export type RegisterInput = (fieldName: string, input: TextInput | null) => void;

export function useFormInputs<TForm extends Pick<AnyFormApi, "state">>() {
  const inputs = useRef(new Map<string, TextInput>());

  const registerInput: RegisterInput = useCallback((fieldName, input) => {
    if (input) {
      inputs.current.set(fieldName, input);
    } else {
      inputs.current.delete(fieldName);
    }
  }, []);

  const focusInput = useCallback((fieldName: DeepKeys<TForm["state"]["values"]> & string) => {
    inputs.current.get(fieldName)?.focus();
  }, []);

  return { registerInput, focusInput };
}
