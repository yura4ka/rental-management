export const applicantProfileKeys = {
  all: ["applicantProfile"] as const,
  detail: () => [...applicantProfileKeys.all, "detail"] as const,
  mutations: () => [...applicantProfileKeys.all, "mutations"] as const,
  updateApplicantInformation: () =>
    [...applicantProfileKeys.all, "mutations", "updateApplicantInformation"] as const,
  updateResidenceHistory: () =>
    [...applicantProfileKeys.all, "mutations", "updateResidenceHistory"] as const,
};
