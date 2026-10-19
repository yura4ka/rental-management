import type { CommandHandler, CommandHandlers } from "@/features/operations/commandCatalog";
import type { ApplicationsRepository } from "@/features/applications/applicationsRepository";
import { applicationMutationSchema } from "@/features/applications/operations/schemas";
import type { ApplicationReviewsRepository } from "../applicationReviewsRepository";
import type { IApplicationReviewsApi } from "../types";
import * as schemas from "./schemas";
import type { ApplicationReviewCommands } from "./types";

export function createApplicationReviewHandlers(
  api: IApplicationReviewsApi,
  applications: ApplicationsRepository,
  repository: ApplicationReviewsRepository,
): CommandHandlers<ApplicationReviewCommands> {
  function action<K extends "StartReview" | "ReturnApplication" | "ApproveApplication">(
    inputSchema: CommandHandler<ApplicationReviewCommands[K]>["inputSchema"],
    requestSchema: CommandHandler<ApplicationReviewCommands[K]>["requestSchema"],
    execute: IApplicationReviewsApi["startReview"],
  ): CommandHandler<ApplicationReviewCommands[K]> {
    return {
      resourceType: "Application",
      inputSchema,
      requestSchema,
      responseSchema: applicationMutationSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ id, ...body }, signal) => execute.call(api, { id }, body, signal),
      persist: (response, tx) => applications.saveDetail(response, tx),
    };
  }

  return {
    StartReview: action<"StartReview">(
      schemas.reviewActionInputSchema,
      schemas.reviewActionRequestSchema,
      api.startReview,
    ),
    ReleaseApplication: action<"StartReview">(
      schemas.reviewActionInputSchema,
      schemas.reviewActionRequestSchema,
      api.releaseApplication,
    ),
    ReturnApplication: action<"ReturnApplication">(
      schemas.reviewOutcomeInputSchema,
      schemas.reviewOutcomeRequestSchema,
      api.returnApplication,
    ),
    DenyApplication: action<"ReturnApplication">(
      schemas.reviewOutcomeInputSchema,
      schemas.reviewOutcomeRequestSchema,
      api.denyApplication,
    ),
    ApproveApplication: action<"ApproveApplication">(
      schemas.approveApplicationInputSchema,
      schemas.approveApplicationRequestSchema,
      api.approveApplication,
    ),
    SaveManagerNote: {
      resourceType: "ManagerNote",
      inputSchema: schemas.saveManagerNoteInputSchema,
      requestSchema: schemas.saveManagerNoteRequestSchema,
      responseSchema: schemas.saveManagerNoteResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ id, ...body }, signal) => api.saveManagerNote({ id }, body, signal),
      persist: (response, tx) => repository.saveNote(response, tx),
    },
    RejectAllApplications: {
      resourceType: "Unit",
      inputSchema: schemas.rejectAllApplicationsInputSchema,
      requestSchema: schemas.rejectAllApplicationsRequestSchema,
      responseSchema: schemas.rejectAllApplicationsResponseSchema,
      prepare: (input, context) => ({ ...input, ...context.metadata }),
      execute: ({ unitId, ...body }, signal) => api.rejectAllApplications({ unitId }, body, signal),
      persist: (response, tx) => repository.saveBulkResult(response, tx),
    },
  };
}
