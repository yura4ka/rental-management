import { z } from "zod";
import {
  journalResponseSchema,
  operationMetadataSchema,
  resourceVersionSchema,
} from "@/features/operations/commandSchemas";

const addressSchema = z.object({
  displayName: z.string().nullable(),
  streetAddress: z.string().nullable(),
  line2: z.string().nullable(),
});
const editableAddress = z.strictObject({
  displayName: z.string().max(100).nullable(),
  streetAddress: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => value.trim().length > 0),
  line2: z.string().max(100).nullable(),
});
export const createPropertyInputSchema = z.strictObject({
  id: z.string().min(1),
  address: editableAddress,
});
export const updatePropertyInputSchema = z.strictObject({
  id: z.string().min(1),
  expectedVersion: resourceVersionSchema,
  address: editableAddress,
});
export const archivePropertyInputSchema = z.strictObject({
  id: z.string().min(1),
  expectedVersion: resourceVersionSchema,
});
export const createPropertyRequestSchema = createPropertyInputSchema.extend(
  operationMetadataSchema.shape,
);
export const updatePropertyRequestSchema = updatePropertyInputSchema.extend(
  operationMetadataSchema.shape,
);
export const archivePropertyRequestSchema = archivePropertyInputSchema.extend(
  operationMetadataSchema.shape,
);
export const propertyResponseSchema = journalResponseSchema.extend({
  id: z.string(),
  address: addressSchema,
  displayAddress: z.string(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: resourceVersionSchema,
});
