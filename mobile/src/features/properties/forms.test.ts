import { propertyFormSchema, toPropertyAddress, toPropertyForm } from "./forms";

it("requires a street address and normalizes optional blank address fields", () => {
  expect(propertyFormSchema.safeParse(toPropertyForm()).success).toBe(false);
  expect(
    toPropertyAddress({
      address: { displayName: "  ", streetAddress: " 12 Main St ", line2: " " },
    }),
  ).toEqual({
    displayName: null,
    streetAddress: "12 Main St",
    line2: null,
  });
  expect(
    propertyFormSchema.safeParse({
      address: { displayName: "x".repeat(101), streetAddress: "Main", line2: "" },
    }).success,
  ).toBe(false);
});
