import { z } from "zod";
import { residenceAddressFormSchema } from "@/features/address/schemas";
import { toAddress } from "@/features/address/utils";
import { residenceFormSchema } from "@/features/applicantProfile/forms/schemas";
import { toProfileFormInput, toResidenceFormInput } from "@/features/applicantProfile/forms/utils";
import type { ApplicantInformationDto, ResidenceDto } from "@/features/applicantProfile/types";
import { phoneSchema } from "@/shared/schemas";

export const applicationInformationFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().pipe(phoneSchema),
  contactEmail: z.string().trim().pipe(z.email().max(254)),
  currentAddress: residenceAddressFormSchema,
});

export const applicationEditorFormSchema = z.object({
  applicantInformation: applicationInformationFormSchema,
  residenceHistory: z.array(residenceFormSchema),
});

export type ApplicationEditorInput = z.infer<typeof applicationEditorFormSchema>;
export type ApplicationSection = "ApplicantInformation" | "ResidenceHistory";
export type ApplicationStep = ApplicationSection | "Summary";

/** Keep the complete input type while validating only the visible section. */
export function applicationStepFormSchema(step: ApplicationStep) {
  return z.object({
    applicantInformation:
      step === "ApplicantInformation"
        ? applicationInformationFormSchema
        : z.custom<ApplicationEditorInput["applicantInformation"]>(),
    residenceHistory:
      step === "ResidenceHistory"
        ? applicationEditorFormSchema.shape.residenceHistory
        : z.custom<ApplicationEditorInput["residenceHistory"]>(),
  });
}

export function editorDefaults(
  information?: ApplicantInformationDto,
  residences: ResidenceDto[] = [],
  email = "",
): ApplicationEditorInput {
  return {
    applicantInformation: toProfileFormInput(
      information ?? { name: null, phone: null, contactEmail: email, currentAddress: null },
    ),
    residenceHistory: residences.map(toResidenceFormInput),
  };
}

export function informationSnapshot(input: ApplicationEditorInput) {
  const value = applicationInformationFormSchema.parse(input.applicantInformation);
  return {
    ...value,
    currentAddress: {
      ...toAddress(value.currentAddress)!,
      streetAddress: value.currentAddress.streetAddress,
    },
  };
}

export function residencesSnapshot(input: ApplicationEditorInput) {
  return z
    .array(residenceFormSchema)
    .parse(input.residenceHistory)
    .map((r) => ({
      ...r,
      address: { ...toAddress(r.address)!, streetAddress: r.address.streetAddress },
    }));
}

export function sectionSnapshot(section: ApplicationSection, input: ApplicationEditorInput) {
  return section === "ApplicantInformation"
    ? informationSnapshot(input)
    : residencesSnapshot(input);
}
