import { z } from "zod";
import {
  journalResponseSchema,
  operationMetadataSchema,
  resourceVersionSchema,
} from "@/features/operations/commandSchemas";
import { profileInformationInput, profileResidencesInput } from "../applicantProfileValidation";

export const updateProfileInformationRequestSchema = profileInformationInput.extend(
  operationMetadataSchema.shape,
);
export const updateProfileResidencesRequestSchema = profileResidencesInput.extend(
  operationMetadataSchema.shape,
);

// Validate accepted DTO structure, not today's form rules: historical receipts may contain older data.
const address = z.looseObject({
  displayName: z.string().nullable(),
  streetAddress: z.string().nullable(),
  line2: z.string().nullable(),
});

export const profileMutationResponseSchema = journalResponseSchema.extend({
  version: resourceVersionSchema,
  applicantInformation: z.looseObject({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    contactEmail: z.string().nullable(),
    currentAddress: address.nullable(),
  }),
  residenceHistory: z.array(
    z.looseObject({
      position: z.number().int().nonnegative(),
      address,
      landlordName: z.string(),
      landlordPhone: z.string(),
      moveInDate: z.string(),
      moveOutDate: z.string(),
    }),
  ),
});
