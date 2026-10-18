import {
  applicationInformationSchema,
  applicationResidencesSchema,
  applicationListSchema,
} from "./applicationValidation";
import { editorDefaults, informationSnapshot, residencesSnapshot } from "./forms";
import { information } from "./testing/fixtures";

it("requires application contact fields even though profile fields may be empty", () => {
  expect(applicationInformationSchema.parse(information)).toEqual(information);
  for (const field of ["name", "phone", "contactEmail", "currentAddress"]) {
    expect(applicationInformationSchema.safeParse({ ...information, [field]: null }).success).toBe(
      false,
    );
  }
  expect(
    applicationInformationSchema.safeParse({
      ...information,
      currentAddress: { ...information.currentAddress, streetAddress: " " },
    }).success,
  ).toBe(false);
  expect(
    applicationInformationSchema.safeParse({ ...information, phone: "1234567890" }).success,
  ).toBe(false);
});

it("prefills only login email and normalizes explicitly continued valid input", () => {
  const input = editorDefaults(undefined, [], "login@example.com");
  expect(input.applicantInformation).toEqual({
    name: "",
    phone: "",
    contactEmail: "login@example.com",
    currentAddress: { displayName: "", streetAddress: "", line2: "" },
  });
  expect(() => informationSnapshot(input)).toThrow();
  input.applicantInformation = editorDefaults(information).applicantInformation;
  input.applicantInformation.name = "  Applicant  ";
  expect(informationSnapshot(input)).toEqual(information);
  expect(residencesSnapshot(input)).toEqual([]);
});

it("supports explicitly saved empty history, but rejects invalid residence dates", () => {
  expect(applicationResidencesSchema.parse([])).toEqual([]);
  const residence = {
    address: information.currentAddress,
    landlordName: "Landlord",
    landlordPhone: "123-456-7890",
    moveInDate: "2020-01-01T00:00:00Z",
    moveOutDate: "2021-01-01T00:00:00Z",
  };
  expect(applicationResidencesSchema.safeParse([residence]).success).toBe(true);
  expect(
    applicationResidencesSchema.safeParse([{ ...residence, moveOutDate: residence.moveInDate }])
      .success,
  ).toBe(false);
  expect(
    applicationResidencesSchema.safeParse([{ ...residence, moveOutDate: "9999-01-01T00:00:00Z" }])
      .success,
  ).toBe(false);
  expect(applicationListSchema.safeParse({ page: 0 }).success).toBe(false);
  expect(applicationListSchema.parse({})).toMatchObject({
    page: 1,
    sortBy: "createdAt",
    sortDirection: "desc",
  });
});
