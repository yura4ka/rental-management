import type { ApplicationsRepository } from "@/features/applications/applicationsRepository";
import { applicationId, unitId } from "@/features/applications/testing/fixtures";
import type { IApplicationReviewsApi } from "../types";
import type { ApplicationReviewsRepository } from "../applicationReviewsRepository";
import { createApplicationReviewHandlers } from "./handlers";
import * as schemas from "./schemas";

it("enforces comments, independent note versions, and unversioned bulk requests", () => {
  const input = { id: applicationId, expectedVersion: "9007199254740993" };
  expect(
    schemas.reviewActionInputSchema.safeParse({ ...input, comment: "not allowed" }).success,
  ).toBe(false);
  expect(schemas.reviewOutcomeInputSchema.safeParse({ ...input, comment: "   " }).success).toBe(
    false,
  );
  expect(schemas.approveApplicationInputSchema.safeParse(input).success).toBe(true);
  expect(
    schemas.saveManagerNoteInputSchema.safeParse({ id: applicationId, body: "" }).success,
  ).toBe(false);
  expect(
    schemas.saveManagerNoteInputSchema.safeParse({
      id: applicationId,
      expectedVersion: null,
      body: "",
    }).success,
  ).toBe(true);
  expect(
    schemas.saveManagerNoteInputSchema.safeParse({
      id: applicationId,
      expectedVersion: null,
      body: null,
    }).success,
  ).toBe(false);
  expect(
    schemas.rejectAllApplicationsInputSchema.safeParse({
      unitId,
      comment: "Reason",
      expectedVersion: "1",
    }).success,
  ).toBe(false);
});

it("freezes route targets and uses only accepted predecessor versions", async () => {
  const api = {
    returnApplication: jest.fn(),
    saveManagerNote: jest.fn(),
    rejectAllApplications: jest.fn(),
  };
  const handlers = createApplicationReviewHandlers(
    api as unknown as IApplicationReviewsApi,
    {} as ApplicationsRepository,
    {} as ApplicationReviewsRepository,
  );
  const context = {
    metadata: { operationId: "operation", environmentGeneration: "generation" },
    predecessorVersion: undefined,
  };
  const input = {
    id: applicationId,
    expectedVersion: "9007199254740993",
    comment: "Please correct",
  };
  const request = handlers.ReturnApplication.prepare(input, context);
  expect(request.expectedVersion).toBe(input.expectedVersion);
  expect(
    handlers.ReturnApplication.prepare(input, {
      ...context,
      predecessorVersion: "9007199254740994",
    }).expectedVersion,
  ).toBe("9007199254740994");
  const signal = new AbortController().signal;
  await handlers.ReturnApplication.execute(request, signal);
  const { id, ...body } = request;
  expect(api.returnApplication).toHaveBeenCalledWith({ id }, body, signal);
  const note = handlers.SaveManagerNote.prepare({ id, expectedVersion: null, body: "" }, context);
  expect(note.expectedVersion).toBeNull();
  expect(
    handlers.SaveManagerNote.prepare(
      { id, expectedVersion: null, body: "second" },
      { ...context, predecessorVersion: "2" },
    ).expectedVersion,
  ).toBe("2");
  const bulk = handlers.RejectAllApplications.prepare(
    { unitId, comment: "Rejected" },
    { ...context, predecessorVersion: "50" },
  );
  expect(bulk).not.toHaveProperty("expectedVersion");
  await handlers.RejectAllApplications.execute(bulk, signal);
  expect(api.rejectAllApplications).toHaveBeenCalledWith(
    { unitId },
    { ...context.metadata, comment: "Rejected" },
    signal,
  );
});
