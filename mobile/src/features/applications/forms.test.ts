import {
  applicationStepFormSchema,
  editorDefaults,
  informationSnapshot,
  residencesSnapshot,
} from "./forms";
import { information } from "./testing/fixtures";

describe("application editor sections", () => {
  it("starts with only the login email and keeps invalid local input representable", () => {
    const input = editorDefaults(undefined, [], "login@example.com");
    expect(input.applicantInformation).toEqual({
      name: "",
      phone: "",
      contactEmail: "login@example.com",
      currentAddress: { displayName: "", streetAddress: "", line2: "" },
    });
    expect(applicationStepFormSchema("ApplicantInformation").safeParse(input).success).toBe(false);
  });

  it("validates only the active section", () => {
    const input = editorDefaults(information);
    input.residenceHistory.push({
      address: { displayName: "", streetAddress: "", line2: "" },
      landlordName: "",
      landlordPhone: "",
      moveInDate: "",
      moveOutDate: "",
    });
    expect(applicationStepFormSchema("ApplicantInformation").safeParse(input).success).toBe(true);
    expect(applicationStepFormSchema("ResidenceHistory").safeParse(input).success).toBe(false);
    input.residenceHistory = [];
    input.applicantInformation.name = "";
    expect(applicationStepFormSchema("ResidenceHistory").safeParse(input).success).toBe(true);
  });

  it("normalizes contact/address snapshots and explicitly preserves empty history", () => {
    const input = editorDefaults(information);
    input.applicantInformation.name = "  Jane  ";
    input.applicantInformation.currentAddress.displayName = " ";
    input.applicantInformation.currentAddress.line2 = "";
    expect(informationSnapshot(input)).toMatchObject({
      name: "Jane",
      currentAddress: { displayName: null, line2: null },
    });
    expect(residencesSnapshot(input)).toEqual([]);
  });
});
