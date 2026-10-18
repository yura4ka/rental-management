import { z } from "zod";
import { priceToCents } from "@/features/inventory/forms";
import type { UnitDto } from "./types";

export const unitFormSchema = z.object({
  number: z
    .string()
    .regex(/^[A-Z0-9_-]{1,20}$/, "Use 1–20 uppercase letters, digits, underscores or hyphens."),
  unitTypeId: z.string().min(1, "Choose a unit type."),
  bedrooms: z.number().int().min(0).max(2147483647),
  monthlyRent: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a positive USD amount with up to two decimal places.")
    .refine((value) => {
      const cents = priceToCents(value);
      return cents !== undefined && cents > 0 && cents <= 999999999999;
    }, "Rent must be positive and no greater than 9,999,999,999.99."),
});
export type UnitFormInput = z.infer<typeof unitFormSchema>;

export function toUnitForm(unit?: UnitDto): UnitFormInput {
  return {
    number: unit?.number ?? "",
    unitTypeId: unit?.unitTypeId ?? "",
    bedrooms: unit?.bedrooms ?? 0,
    monthlyRent: unit
      ? `${Math.floor(unit.monthlyRentCents / 100)}.${String(unit.monthlyRentCents % 100).padStart(2, "0")}`
      : "",
  };
}

export function toUnitFields(value: UnitFormInput) {
  const { monthlyRent, ...fields } = unitFormSchema.parse(value);
  return { ...fields, monthlyRentCents: priceToCents(monthlyRent)! };
}
