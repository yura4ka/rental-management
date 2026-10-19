import { profileFormSchema, residencesFormSchema } from "./schemas";
import { toApplicantInformation, toProfileFormInput, toResidenceFormInput } from "./utils";

const emptyProfile = { name: null, phone: null, contactEmail: null, currentAddress: null };
const residence = {
  address: { displayName: "Home", streetAddress: "12 Main St", line2: "" },
  landlordName: "Owner",
  landlordPhone: "123-456-7890",
  moveInDate: "2020-01-01T00:00:00Z",
  moveOutDate: "2021-01-01T00:00:00Z",
};

describe("profile forms", () => {
  it("accepts empty optional contact values and normalizes blanks", () => {
    const input = profileFormSchema.parse(toProfileFormInput(emptyProfile));
    expect(toApplicantInformation(input)).toEqual(emptyProfile);
    expect(toApplicantInformation({ ...input, name: "  " })).toEqual(emptyProfile);
  });

  it("rejects supplied invalid contact values", () => {
    const input = toProfileFormInput(emptyProfile);
    expect(profileFormSchema.safeParse({ ...input, phone: "123" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...input, contactEmail: "invalid" }).success).toBe(false);
    expect(
      profileFormSchema.safeParse({ ...input, phone: "123-456-7890", contactEmail: "a@b.com" })
        .success,
    ).toBe(true);
  });

  it("allows deleting all residences, but new rows must be complete", () => {
    expect(residencesFormSchema.safeParse({ residenceHistory: [] }).success).toBe(true);
    expect(
      residencesFormSchema.safeParse({ residenceHistory: [toResidenceFormInput()] }).success,
    ).toBe(false);
    expect(residencesFormSchema.safeParse({ residenceHistory: [residence] }).success).toBe(true);
  });

  it("rejects reversed, identical, invalid and future residence dates", () => {
    for (const moveOutDate of [
      "2019-01-01T00:00:00Z",
      residence.moveInDate,
      "2021-02-30T00:00:00Z",
      "2999-01-01T00:00:00Z",
    ]) {
      expect(
        residencesFormSchema.safeParse({ residenceHistory: [{ ...residence, moveOutDate }] })
          .success,
      ).toBe(false);
    }
  });
});
