import type { CommandHandlers } from "@/features/operations/commandCatalog";
import type { ApplicantProfileRepository } from "../applicantProfileRepository";
import { profileInformationInput, profileResidencesInput } from "../applicantProfileValidation";
import type { IApplicantProfileApi } from "../types";
import {
  profileMutationResponseSchema,
  updateProfileInformationRequestSchema,
  updateProfileResidencesRequestSchema,
} from "./schemas";
import type { ApplicantProfileCommands } from "./types";

/** Feature dictionary composed once at session creation; API methods are the only route definitions. */
export function createApplicantProfileHandlers(
  api: IApplicantProfileApi,
  repository: ApplicantProfileRepository,
): CommandHandlers<ApplicantProfileCommands> {
  return {
    UpdateProfileInformation: {
      resourceType: "Profile",
      inputSchema: profileInformationInput,
      requestSchema: updateProfileInformationRequestSchema,
      responseSchema: profileMutationResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: (request, signal) => api.updateApplicantInformation(request, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
    UpdateProfileResidences: {
      resourceType: "Profile",
      inputSchema: profileResidencesInput,
      requestSchema: updateProfileResidencesRequestSchema,
      responseSchema: profileMutationResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: (request, signal) => api.updateResidenceHistory(request, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
  };
}
