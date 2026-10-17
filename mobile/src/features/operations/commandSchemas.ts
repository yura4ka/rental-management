import { z } from "zod";

/** Shared wire shapes; IDs stay strings and versions never pass through JavaScript Number. */
export const operationMetadataSchema = z.object({
  operationId: z.string().min(1),
  environmentGeneration: z.string().min(1),
});

export const resourceVersionSchema = z.string().regex(/^[1-9]\d*$/);

export const journalResponseSchema = z.looseObject({
  operationId: z.string().min(1),
  outcome: z.literal("Accepted"),
  affectedResources: z.array(
    z.looseObject({
      resourceType: z.string().min(1),
      id: z.string().min(1),
      version: resourceVersionSchema.nullable(),
    }),
  ),
});
