import { z } from "zod";
import { addressFormSchema, residenceAddressFormSchema } from "@/features/address/schemas";
import { pastUtcMidnightDateSchema, phoneSchema } from "@/shared/schemas";

const optionalPhone = z.union([z.literal(""), phoneSchema]);
const optionalEmail = z.union([z.literal(""), z.email().max(254)]);

export const profileFormSchema = z.object({
  name: z.string().trim().max(100),
  phone: z.string().trim().pipe(optionalPhone),
  contactEmail: z.string().trim().pipe(optionalEmail),
  currentAddress: addressFormSchema,
});

export const residenceFormSchema = z
  .object({
    address: residenceAddressFormSchema,
    landlordName: z.string().trim().min(1, "Landlord name is required.").max(100),
    landlordPhone: z.string().trim().pipe(phoneSchema),
    moveInDate: pastUtcMidnightDateSchema,
    moveOutDate: pastUtcMidnightDateSchema,
  })
  .refine((value) => value.moveInDate < value.moveOutDate, {
    path: ["moveOutDate"],
    message: "Move-out must follow move-in.",
  });

export const residencesFormSchema = z.object({
  residenceHistory: z.array(residenceFormSchema),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;
export type ResidenceFormInput = z.infer<typeof residenceFormSchema>;
export type ResidencesFormInput = z.infer<typeof residencesFormSchema>;
