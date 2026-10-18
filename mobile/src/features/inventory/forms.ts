import { z } from "zod";
import type { GetAvailableUnitsRequestParams } from "./types";

export function priceToCents(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

const price = z
  .string()
  .refine(
    (value) => !value.trim() || /^\d{1,10}(\.\d{1,2})?$/.test(value.trim()),
    "Use a USD amount with up to two decimal places.",
  )
  .refine(
    (value) => !value.trim() || (priceToCents(value) ?? Infinity) <= 999999999999,
    "Price is too large.",
  );

export const inventoryFiltersSchema = z
  .object({
    unitTypeIds: z.array(z.string()),
    bedrooms: z.number().int().min(1).max(10).nullable(),
    priceFrom: price,
    priceTo: price,
  })
  .refine(
    (value) => {
      const from = priceToCents(value.priceFrom);
      const to = priceToCents(value.priceTo);
      return from === undefined || to === undefined || from <= to;
    },
    { path: ["priceTo"], message: "Must be at least the minimum price." },
  );

export type InventoryFilters = z.infer<typeof inventoryFiltersSchema>;
export const defaultInventoryFilters: InventoryFilters = {
  unitTypeIds: [],
  bedrooms: null,
  priceFrom: "",
  priceTo: "",
};

export function toInventoryParams(filters: InventoryFilters): GetAvailableUnitsRequestParams {
  const valid = inventoryFiltersSchema.parse(filters);
  return {
    unitTypeIds: valid.unitTypeIds.length ? [...valid.unitTypeIds].sort() : undefined,
    bedrooms: valid.bedrooms ?? undefined,
    priceFrom: priceToCents(valid.priceFrom),
    priceTo: priceToCents(valid.priceTo),
  };
}

export const inventorySortOptions = [
  { label: "Default order", value: "default" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
  { label: "Newest first", value: "createdAt-desc" },
  { label: "Oldest first", value: "createdAt-asc" },
] as const;
export type InventorySort = (typeof inventorySortOptions)[number]["value"];

export function toSortParams(sort: InventorySort): GetAvailableUnitsRequestParams {
  switch (sort) {
    case "price-asc":
      return { sortBy: "price", sortDirection: "asc" };
    case "price-desc":
      return { sortBy: "price", sortDirection: "desc" };
    case "createdAt-asc":
      return { sortBy: "createdAt", sortDirection: "asc" };
    case "createdAt-desc":
      return { sortBy: "createdAt", sortDirection: "desc" };
    default:
      return {};
  }
}

export function formatMonthlyRent(cents: number): string {
  return `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)}/mo`;
}
