import { z } from "zod";
import { journalResponseSchema, resourceVersionSchema } from "@/features/operations/commandSchemas";
import { applicationStatusSchema } from "../applicationValidation";

const address = z.looseObject({
  displayName: z.string().nullable(),
  streetAddress: z.string().nullable(),
  line2: z.string().nullable(),
});

export const managerNoteSchema = z.looseObject({
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: resourceVersionSchema,
});

export const applicationRowSchema = z.looseObject({
  id: z.string(),
  applicantId: z.string(),
  unitId: z.string(),
  propertyId: z.string(),
  unitNumber: z.string(),
  propertyAddress: address,
  isArchived: z.boolean(),
  applicantName: z.string(),
  status: applicationStatusSchema,
  createdAt: z.string(),
  statusChangedAt: z.string(),
  version: resourceVersionSchema,
});

// Historical receipts validate DTO structure, not current editor validation rules.
export const applicationDetailSchema = z.looseObject({
  application: applicationRowSchema,
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
  applicantInformationSavedAt: z.string(),
  residenceHistorySavedAt: z.string().nullable(),
  history: z.array(
    z.looseObject({
      id: z.string(),
      sequence: z.number().int(),
      actorUserId: z.string(),
      action: z.enum([
        "Create",
        "Submit",
        "StartReview",
        "Release",
        "Return",
        "Deny",
        "Approve",
        "Withdraw",
      ]),
      fromStatus: applicationStatusSchema.nullable(),
      toStatus: applicationStatusSchema,
      comment: z.string().nullable(),
      occurredAt: z.string(),
    }),
  ),
  lease: z
    .looseObject({
      id: z.string(),
      startDate: z.string(),
      endDateExclusive: z.string(),
      approvedAt: z.string(),
    })
    .nullable(),
  myNote: managerNoteSchema.nullable(),
});

export const applicationMutationSchema = applicationDetailSchema.extend(
  journalResponseSchema.shape,
);
