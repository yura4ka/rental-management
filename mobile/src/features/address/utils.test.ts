import { addressFormSchema, residenceAddressFormSchema } from "./schemas";
import { getAddressDisplayName, toAddress, toAddressInput } from "./utils";

describe("reusable addresses", () => {
  it("joins the supplied address parts in order", () => {
    expect(
      getAddressDisplayName({ displayName: "Home", streetAddress: "12 Main St", line2: "Apt 3" }),
    ).toBe("Home, 12 Main St, Apt 3");
    expect(
      getAddressDisplayName({ displayName: null, streetAddress: "12 Main St", line2: "" }),
    ).toBe("12 Main St");
    expect(getAddressDisplayName(null)).toBe("");
  });

  it("maps nullable addresses to text inputs and blanks back to null", () => {
    expect(toAddressInput(null)).toEqual({ displayName: "", streetAddress: "", line2: "" });
    expect(toAddress({ displayName: " ", streetAddress: "", line2: "" })).toBeNull();
    expect(toAddress({ displayName: " Home ", streetAddress: " 12 Main St ", line2: " " })).toEqual(
      { displayName: "Home", streetAddress: "12 Main St", line2: null },
    );
  });

  it("allows an incomplete current address but requires a residence street", () => {
    const empty = toAddressInput();
    expect(addressFormSchema.safeParse(empty).success).toBe(true);
    expect(residenceAddressFormSchema.safeParse(empty).success).toBe(false);
    expect(addressFormSchema.safeParse({ ...empty, line2: "x".repeat(101) }).success).toBe(false);
  });
});
