import { z } from "zod";

const version = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n);
const phone = z.string().regex(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/);
const address = z
  .object({
    displayName: z.string().max(100).nullable(),
    streetAddress: z.string().max(200).nullable(),
    line2: z.string().max(100).nullable(),
  })
  .strict();

export const profileInformationInput = z
  .object({
    expectedVersion: version,
    applicantInformation: z
      .object({
        name: z.string().max(100).nullable(),
        phone: phone.nullable(),
        contactEmail: z.string().max(254).email().nullable(),
        currentAddress: address.nullable(),
      })
      .strict(),
  })
  .strict();

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/)
  .refine((value) => {
    const parsed = new Date(value);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().replace(".000Z", "Z") === value &&
      value.slice(0, 10) <= new Date().toISOString().slice(0, 10)
    );
  }, "Supply a valid UTC-midnight date that is not in the future.");

export const profileResidencesInput = z
  .object({
    expectedVersion: version,
    residenceHistory: z.array(
      z
        .object({
          address: address.extend({ streetAddress: z.string().min(1).max(200) }),
          landlordName: z.string().min(1).max(100),
          landlordPhone: phone,
          moveInDate: date,
          moveOutDate: date,
        })
        .strict()
        .refine((row) => row.moveInDate < row.moveOutDate, {
          path: ["moveOutDate"],
          message: "Move-out must follow move-in.",
        }),
    ),
  })
  .strict();
