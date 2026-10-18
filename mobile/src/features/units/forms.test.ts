import { availableUnit } from "@/features/inventory/testing/fixtures";
import { toUnitFields, toUnitForm, unitFormSchema } from "./forms";

it("round-trips rent using integer cents and supports zero bedrooms", () => {
  const input = { ...toUnitForm(availableUnit.unit), bedrooms: 0, monthlyRent: "1234.56" };
  expect(toUnitFields(input)).toEqual({
    number: "A1",
    unitTypeId: "type",
    bedrooms: 0,
    monthlyRentCents: 123456,
  });
  expect(toUnitForm({ ...availableUnit.unit, monthlyRentCents: 101 }).monthlyRent).toBe("1.01");
});

it.each([
  { number: "a1" },
  { number: " A1" },
  { number: "A".repeat(21) },
  { bedrooms: -1 },
  { bedrooms: 1.5 },
  { unitTypeId: "" },
  { monthlyRent: "0" },
  { monthlyRent: "1.001" },
  { monthlyRent: "10000000000.00" },
])("rejects invalid unit input without normalizing it: %j", (invalid) => {
  expect(unitFormSchema.safeParse({ ...toUnitForm(availableUnit.unit), ...invalid }).success).toBe(
    false,
  );
});
