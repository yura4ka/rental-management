import { withForm } from "@/app/form";
import { Button, Text } from "@/components/ui";
import { editorDefaults, type ApplicationStep } from "../forms";

export const ApplicationFormFooter = withForm({
  defaultValues: editorDefaults(),
  props: {} as {
    step: ApplicationStep;
    disabled: boolean;
    submitBlocked: boolean;
    needsCorrection: boolean;
    replacing: boolean;
    onCorrect: () => void;
    onBack: () => void;
  },
  render: function ApplicationFormFooter({
    form,
    step,
    disabled,
    submitBlocked,
    needsCorrection,
    replacing,
    onCorrect,
    onBack,
  }) {
    return (
      <>
        {needsCorrection && (
          <Button title="Correct rejected save" disabled={disabled} onPress={onCorrect} />
        )}
        {replacing && (
          <Text>Continue will replace the rejected save and cancel its unsent dependent work.</Text>
        )}
        {step !== "ApplicantInformation" && (
          <Button title="Back" variant="secondary" disabled={disabled} onPress={onBack} />
        )}
        <form.SubmitButton
          title={step === "Summary" ? "Submit application" : "Continue"}
          disabled={disabled || needsCorrection || (step === "Summary" && submitBlocked)}
        />
      </>
    );
  },
});
