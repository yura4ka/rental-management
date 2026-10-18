import { getFieldErrors } from "@/shared/utils/errorUtils";
import type { ApplicationEditorInput, ApplicationStep } from "./forms";

export function applicationFormFieldErrors(
  error: unknown,
  value: ApplicationEditorInput,
  step: ApplicationStep,
) {
  const paths =
    step === "ApplicantInformation"
      ? ([
          "applicantInformation.name",
          "applicantInformation.phone",
          "applicantInformation.contactEmail",
          "applicantInformation.currentAddress.displayName",
          "applicantInformation.currentAddress.streetAddress",
          "applicantInformation.currentAddress.line2",
        ] as const)
      : value.residenceHistory.flatMap(
          (_, index) =>
            [
              `residenceHistory[${index}].address.displayName`,
              `residenceHistory[${index}].address.streetAddress`,
              `residenceHistory[${index}].address.line2`,
              `residenceHistory[${index}].landlordName`,
              `residenceHistory[${index}].landlordPhone`,
              `residenceHistory[${index}].moveInDate`,
              `residenceHistory[${index}].moveOutDate`,
            ] as const,
        );
  return getFieldErrors(error, paths);
}
