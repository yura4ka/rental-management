import { z } from "zod";
import { addressSchema } from "@/features/address/schemas";
import { profileResidencesInput } from "@/features/applicantProfile/applicantProfileValidation";
import { phoneSchema, versionSchema } from "@/shared/schemas";

export const applicationStatusSchema = z.enum([
  "Draft",
  "Submitted",
  "InReview",
  "Returned",
  "Approved",
  "Denied",
  "Withdrawn",
]);

export const applicationInformationSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  contactEmail: z.email().max(254),
  currentAddress: addressSchema
    .extend({ streetAddress: z.string().trim().min(1).max(200) })
    .strict(),
});

export const applicationResidencesSchema = profileResidencesInput.shape.residenceHistory;

export const applicationListSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  status: applicationStatusSchema.nullable().optional(),
  propertyId: z.uuid().nullable().optional(),
  showArchived: z.boolean().optional(),
  sortBy: z.enum(["createdAt", "statusChangedAt"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const createApplicationInputSchema = z.strictObject({
  id: z.uuidv7(),
  unitId: z.uuid(),
  applicantInformation: applicationInformationSchema,
});

export const applicationInformationInputSchema = z.strictObject({
  id: z.uuid(),
  expectedVersion: versionSchema,
  applicantInformation: applicationInformationSchema,
});

export const applicationResidencesInputSchema = z.strictObject({
  id: z.uuid(),
  expectedVersion: versionSchema,
  residenceHistory: applicationResidencesSchema,
});

export const applicationActionInputSchema = z.strictObject({
  id: z.uuid(),
  expectedVersion: versionSchema,
});
