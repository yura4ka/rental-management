import { z } from "zod";
import {
  addressSchema,
  phoneSchema,
  versionSchema,
  pastUtcMidnightDateSchema,
} from "@/shared/schemas";

export const profileInformationInput = z
  .object({
    expectedVersion: versionSchema,
    applicantInformation: z
      .object({
        name: z.string().max(100).nullable(),
        phone: phoneSchema.nullable(),
        contactEmail: z.string().max(254).email().nullable(),
        currentAddress: addressSchema.nullable(),
      })
      .strict(),
  })
  .strict();

export const profileResidencesInput = z
  .object({
    expectedVersion: versionSchema,
    residenceHistory: z.array(
      z
        .object({
          address: addressSchema.extend({ streetAddress: z.string().min(1).max(200) }),
          landlordName: z.string().min(1).max(100),
          landlordPhone: phoneSchema,
          moveInDate: pastUtcMidnightDateSchema,
          moveOutDate: pastUtcMidnightDateSchema,
        })
        .strict()
        .refine((row) => row.moveInDate < row.moveOutDate, {
          path: ["moveOutDate"],
          message: "Move-out must follow move-in.",
        }),
    ),
  })
  .strict();
