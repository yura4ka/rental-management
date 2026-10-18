import { Button, type ButtonProps } from "@/components/ui/Button/Button";
import { useFormContext } from "./form-context";

export type SubmitButtonProps = Omit<ButtonProps, "onPress" | "isLoadingLeft">;

export function SubmitButton({ disabled = false, ...props }: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe
      selector={(state) =>
        [
          state.canSubmit && state.isValid && !state.isValidating && !state.isSubmitting,
          state.isSubmitting,
        ] as const
      }
    >
      {([canSubmit, isSubmitting]) => (
        <Button
          {...props}
          disabled={disabled || !canSubmit}
          isLoadingLeft={isSubmitting}
          onPress={() => {
            const state = form.state;
            if (
              !disabled &&
              state.canSubmit &&
              state.isValid &&
              !state.isValidating &&
              !state.isSubmitting
            ) {
              void form.handleSubmit();
            }
          }}
        />
      )}
    </form.Subscribe>
  );
}
