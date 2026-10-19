import { z } from "zod";
import {
  journalResponseSchema,
  operationMetadataSchema,
  resourceVersionSchema,
} from "@/features/operations/commandSchemas";

const target = { id: z.string().min(1), propertyId: z.string().min(1) };
const fields = {
  number: z.string().regex(/^[A-Z0-9_-]{1,20}$/),
  unitTypeId: z.string().min(1),
  bedrooms: z.number().int().min(0).max(2147483647),
  monthlyRentCents: z.number().int().min(1).max(999999999999),
};
export const createUnitInputSchema = z.strictObject({ ...target, ...fields });
export const updateUnitInputSchema = z.strictObject({
  ...target,
  ...fields,
  expectedVersion: resourceVersionSchema,
});
export const archiveUnitInputSchema = z.strictObject({
  ...target,
  expectedVersion: resourceVersionSchema,
});
export const createUnitRequestSchema = createUnitInputSchema.extend(operationMetadataSchema.shape);
export const updateUnitRequestSchema = updateUnitInputSchema.extend(operationMetadataSchema.shape);
export const archiveUnitRequestSchema = archiveUnitInputSchema.extend(
  operationMetadataSchema.shape,
);
export const unitResponseSchema = journalResponseSchema.extend({
  ...target,
  number: z.string(),
  unitTypeId: z.string(),
  bedrooms: z.number().int(),
  monthlyRentCents: z.number().int(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: resourceVersionSchema,
});
