import type { CommandHandlers } from "@/features/operations/commandCatalog";
import { operationMetadataSchema } from "@/features/operations/commandSchemas";
import type { ApplicationsRepository } from "../applicationsRepository";
import type { IApplicationsApi } from "../types";
import {
  createApplicationInputSchema,
  applicationInformationInputSchema,
  applicationResidencesInputSchema,
  applicationActionInputSchema,
} from "../applicationValidation";
import { applicationMutationSchema } from "./schemas";
import type { ApplicationCommands } from "./types";

export function createApplicationHandlers(
  api: IApplicationsApi,
  repository: ApplicationsRepository,
): CommandHandlers<ApplicationCommands> {
  const action = (
    execute: IApplicationsApi["submitApplication"],
  ): CommandHandlers<ApplicationCommands>["SubmitApplication"] => ({
    resourceType: "Application",
    inputSchema: applicationActionInputSchema,
    requestSchema: applicationActionInputSchema.extend(operationMetadataSchema.shape),
    responseSchema: applicationMutationSchema,
    prepare: (input, context) => ({
      ...input,
      ...context.metadata,
      expectedVersion: context.predecessorVersion ?? input.expectedVersion,
    }),
    execute: ({ id, ...body }, signal) => execute.call(api, { id }, body, signal),
    persist: (response, tx) => repository.saveDetail(response, tx),
  });

  return {
    CreateApplication: {
      resourceType: "Application",
      inputSchema: createApplicationInputSchema,
      requestSchema: createApplicationInputSchema.extend(operationMetadataSchema.shape),
      responseSchema: applicationMutationSchema,
      prepare: (input, context) => ({ ...input, ...context.metadata }),
      execute: (request, signal) => api.createApplication(request, signal),
      persist: (response, tx) => repository.saveDetail(response, tx),
    },
    UpdateApplicationInformation: {
      resourceType: "Application",
      inputSchema: applicationInformationInputSchema,
      requestSchema: applicationInformationInputSchema.extend(operationMetadataSchema.shape),
      responseSchema: applicationMutationSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ id, ...body }, signal) => api.updateApplicationInformation({ id }, body, signal),
      persist: (response, tx) => repository.saveDetail(response, tx),
    },
    UpdateApplicationResidences: {
      resourceType: "Application",
      inputSchema: applicationResidencesInputSchema,
      requestSchema: applicationResidencesInputSchema.extend(operationMetadataSchema.shape),
      responseSchema: applicationMutationSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ id, ...body }, signal) => api.updateApplicationResidences({ id }, body, signal),
      persist: (response, tx) => repository.saveDetail(response, tx),
    },
    SubmitApplication: action(api.submitApplication),
    WithdrawApplication: action(api.withdrawApplication),
  };
}
