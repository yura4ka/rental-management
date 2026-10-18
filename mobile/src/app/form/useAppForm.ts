import { createFormHook } from "@tanstack/react-form";
import { FormInput } from "./FormInput";
import { FormInputPressable } from "./FormInputPressable";
import { SubmitButton } from "./SubmitButton";
import { fieldContext, formContext } from "./form-context";

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { FormInput, FormInputPressable },
  formComponents: { SubmitButton },
});
