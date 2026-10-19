import type { GetApplicationResponse } from "../types";

export const applicationId = "019c0000-0000-7000-8000-000000000001";
export const unitId = "019c0000-0000-7000-8000-000000000002";
export const applicantId = "019c0000-0000-7000-8000-000000000003";
export const propertyId = "019c0000-0000-7000-8000-000000000004";
export const managerId = "019c0000-0000-7000-8000-000000000005";
export const generation = "019c0000-0000-7000-8000-000000000006";
export const information = {
  name: "Applicant",
  phone: "123-456-7890",
  contactEmail: "applicant@example.com",
  currentAddress: { displayName: null, streetAddress: "1 Main Street", line2: null },
};

export const applicationDetail: GetApplicationResponse = {
  application: {
    id: applicationId,
    applicantId,
    unitId,
    propertyId,
    unitNumber: "1A",
    propertyAddress: information.currentAddress,
    isArchived: false,
    applicantName: information.name,
    status: "Draft",
    createdAt: "2026-01-01T12:00:00Z",
    statusChangedAt: "2026-01-01T12:00:00Z",
    version: "1",
  },
  applicantInformation: information,
  residenceHistory: [],
  applicantInformationSavedAt: "2026-01-01T12:00:00Z",
  residenceHistorySavedAt: null,
  history: [
    {
      id: "history",
      sequence: 1,
      actorUserId: applicantId,
      action: "Create",
      fromStatus: null,
      toStatus: "Draft",
      comment: null,
      occurredAt: "2026-01-01T12:00:00Z",
    },
  ],
  lease: null,
  myNote: null,
};
