import { z } from "zod";

export const addressSchema = z
  .object({
    displayName: z.string().max(100).nullable(),
    streetAddress: z.string().max(200).nullable(),
    line2: z.string().max(100).nullable(),
  })
  .strict();

/** Text inputs stay strings while editing; nullable wire values are mapped at submission. */
export const addressFormSchema = z.object({
  displayName: z.string().trim().max(100),
  streetAddress: z.string().trim().max(200),
  line2: z.string().trim().max(100),
});

export const residenceAddressFormSchema = addressFormSchema.extend({
  streetAddress: z.string().trim().min(1, "Street address is required.").max(200),
});
