import { z } from "zod";
import {
  operationMetadataSchema,
  journalResponseSchema,
} from "@/features/operations/commandSchemas";
import { applicationActionInputSchema } from "@/features/applications/applicationValidation";
import { managerNoteSchema } from "@/features/applications/operations/schemas";
import { versionSchema } from "@/shared/schemas";

const requiredComment = z
  .string()
  .max(2000)
  .refine((value) => value.trim().length > 0, "A comment is required.");

export const reviewActionInputSchema = applicationActionInputSchema;
export const reviewOutcomeInputSchema = applicationActionInputSchema.extend({
  comment: requiredComment,
});
export const approveApplicationInputSchema = applicationActionInputSchema.extend({
  comment: z.string().max(2000).nullable().optional(),
});
export const saveManagerNoteInputSchema = z.strictObject({
  id: z.uuid(),
  expectedVersion: versionSchema.nullable(),
  body: z.string().max(2000),
});
export const rejectAllApplicationsInputSchema = z.strictObject({
  unitId: z.uuid(),
  comment: requiredComment,
});

export const reviewActionRequestSchema = reviewActionInputSchema.extend(
  operationMetadataSchema.shape,
);
export const reviewOutcomeRequestSchema = reviewOutcomeInputSchema.extend(
  operationMetadataSchema.shape,
);
export const approveApplicationRequestSchema = approveApplicationInputSchema.extend(
  operationMetadataSchema.shape,
);
export const saveManagerNoteRequestSchema = saveManagerNoteInputSchema.extend(
  operationMetadataSchema.shape,
);
export const rejectAllApplicationsRequestSchema = rejectAllApplicationsInputSchema.extend(
  operationMetadataSchema.shape,
);
export const saveManagerNoteResponseSchema = managerNoteSchema.extend(journalResponseSchema.shape);
export const rejectAllApplicationsResponseSchema = journalResponseSchema.extend({
  affectedCount: z.number().int().nonnegative(),
});
