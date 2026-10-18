import { z } from "zod";

export const addressSchema = z
  .object({
    displayName: z.string().max(100).nullable(),
    streetAddress: z.string().max(200).nullable(),
    line2: z.string().max(100).nullable(),
  })
  .strict();

export const pastUtcMidnightDateSchema = z
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

/** Positive signed-bigint version, kept as a string to preserve precision. */
export const versionSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n);

export const phoneSchema = z.string().regex(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/);
