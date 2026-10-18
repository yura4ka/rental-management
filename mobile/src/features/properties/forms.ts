import { z } from "zod";
import type { PropertyDto } from "./types";

export const propertyFormSchema = z.object({
  address: z.object({
    displayName: z.string().trim().max(100),
    streetAddress: z.string().trim().min(1, "Street address is required.").max(200),
    line2: z.string().trim().max(100),
  }),
});
export type PropertyFormInput = z.infer<typeof propertyFormSchema>;

export function toPropertyForm(property?: PropertyDto): PropertyFormInput {
  return {
    address: {
      displayName: property?.address.displayName ?? "",
      streetAddress: property?.address.streetAddress ?? "",
      line2: property?.address.line2 ?? "",
    },
  };
}

export function toPropertyAddress(value: PropertyFormInput) {
  const { address } = propertyFormSchema.parse(value);
  return {
    displayName: address.displayName || null,
    streetAddress: address.streetAddress,
    line2: address.line2 || null,
  };
}
