import { NetworkError, HTTPError } from "@/services/api";
import type { INetwork } from "@/services/network";
import { CommandCatalog } from "@/features/operations/commandCatalog";
import { OperationsRepository } from "@/features/operations/operationsRepository";
import { OperationsService } from "@/features/operations/operationsService";
import type { IOperationsApi } from "@/features/operations/types";
import { ApplicationsRepository } from "./applicationsRepository";
import { ApplicationEditorRepository } from "./applicationEditorRepository";
import { ApplicationsService } from "./applicationsService";
import { createApplicationHandlers } from "./operations/handlers";
import { editorDefaults } from "./forms";
import type {
  CreateApplicationRequestBody,
  UpdateApplicationResidencesRequestBody,
  ApplicationActionRequestBody,
  GetApplicationResponse,
  IApplicationsApi,
} from "./types";
import { applicationDetail, information, unitId } from "./testing/fixtures";
import { testDatabase } from "./testing/testDatabase";

function setup(online = false) {
  const database = testDatabase();
  const repository = new ApplicationsRepository(database.db);
  const editors = new ApplicationEditorRepository(database.db);
  const network = { isOnline: jest.fn().mockResolvedValue(online) };
  const scope = new AbortController();
  let server: GetApplicationResponse = applicationDetail;
  const accepted = (operationId: string) => ({
    ...server,
    operationId,
    outcome: "Accepted" as const,
    affectedResources: [
      {
        resourceType: "Application",
        id: server.application.id,
        version: server.application.version,
      },
    ],
  });
  const api = {
    getApplications: jest.fn().mockResolvedValue({
      rows: [applicationDetail.application],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
    getApplication: jest.fn().mockResolvedValue(applicationDetail),
    createApplication: jest.fn(async (body: CreateApplicationRequestBody) => {
      server = {
        ...applicationDetail,
        application: { ...applicationDetail.application, id: body.id },
        applicantInformation: body.applicantInformation,
      };
      return accepted(body.operationId);
    }),
    updateApplicationInformation: jest.fn(),
    updateApplicationResidences: jest.fn(
      async (_params, body: UpdateApplicationResidencesRequestBody) => {
        expect(body.expectedVersion).toBe(server.application.version);
        server = {
          ...server,
          application: {
            ...server.application,
            version: String(BigInt(server.application.version) + 1n),
          },
          residenceHistorySavedAt: "2026-01-02T00:00:00Z",
        };
        return accepted(body.operationId);
      },
    ),
    submitApplication: jest.fn(async (_params, body: ApplicationActionRequestBody) => {
      expect(body.expectedVersion).toBe(server.application.version);
      server = {
        ...server,
        application: {
          ...server.application,
          status: "Submitted",
          version: String(BigInt(server.application.version) + 1n),
        },
      };
      return accepted(body.operationId);
    }),
    withdrawApplication: jest.fn(),
  } satisfies IApplicationsApi;
  const receipts = { getOperation: jest.fn() } satisfies IOperationsApi;
  const operationsRepository = new OperationsRepository(database.db);
  const operations = new OperationsService(
    operationsRepository,
    receipts,
    network as unknown as INetwork,
    scope.signal,
    async () => ({}),
    new CommandCatalog(createApplicationHandlers(api, repository)),
  );
  // The application-wide command catalog has additional commands; this test binds only this feature.
  const service = new ApplicationsService(
    api,
    repository,
    editors,
    operations as unknown as OperationsService,
    network as unknown as INetwork,
    scope.signal,
  );
  return {
    ...database,
    api,
    repository,
    editors,
    network,
    scope,
    operations,
    operationsRepository,
    service,
    receipts,
  };
}

describe("ApplicationsService", () => {
  let context: ReturnType<typeof setup>;
  afterEach(() => context.close());

  it("persists unfinished drafts without creating a server application or journal work", async () => {
    context = setup();
    const draft = await context.service.startDraft(unitId);
    expect(draft.input.applicantInformation.contactEmail).toBe("login@example.com");
    draft.input.applicantInformation.name = "Unfinished";
    await context.service.saveDraft(draft.applicationId, draft.input);
    await expect(
      context.service.continueApplicantInformation(draft.applicationId),
    ).rejects.toThrow();
    expect(
      (await context.service.getEditor(draft.applicationId))?.input.applicantInformation.name,
    ).toBe("Unfinished");
    expect(await context.operations.getAll()).toEqual([]);
    expect(context.api.createApplication).not.toHaveBeenCalled();
    expect((await context.service.getApplications()).data.total).toBe(0);
    expect(await context.service.startDraft(unitId)).toMatchObject({
      applicationId: draft.applicationId,
    });
  });

  it("durably chains offline creation, saved-empty history, and submission with accepted predecessor versions", async () => {
    context = setup();
    const draft = await context.service.startDraft(unitId);
    const id = draft.applicationId;
    await context.service.saveDraft(id, editorDefaults(information));
    expect((await context.service.continueApplicantInformation(id)).status).toBe("Pending");
    await context.service.continueResidenceHistory(id);
    const summary = await context.service.getSummary(id);
    expect(summary).toMatchObject({
      hasUnfinishedEdits: false,
      sectionsAccepted: false,
      residenceHistory: [],
    });
    expect(await context.service.getLocalDrafts()).toHaveLength(1);
    await context.service.submitApplication({ id, expectedVersion: "1" });
    const operations = await context.operations.getAll();
    expect(operations.map((o) => o.command)).toEqual([
      "CreateApplication",
      "UpdateApplicationResidences",
      "SubmitApplication",
    ]);
    expect(operations[1].waitingOnOperationId).toBe(operations[0].id);
    expect(operations[2].waitingOnOperationId).toBe(operations[1].id);
    await expect(context.service.saveDraft(id, editorDefaults(information))).rejects.toThrow(
      "pending",
    );
    context.network.isOnline.mockResolvedValue(true);
    await context.operations.processPending();
    expect((await context.operations.getAll()).map((o) => o.state)).toEqual([
      "Accepted",
      "Accepted",
      "Accepted",
    ]);
    expect((await context.repository.getDetail(id))?.application).toMatchObject({
      status: "Submitted",
      version: "3",
    });
    expect((await context.service.getSummary(id)).sectionsAccepted).toBe(true);
    expect(await context.service.getLocalDrafts()).toHaveLength(0);
  });

  it("blocks submission when input differs from the latest Continue snapshot", async () => {
    context = setup();
    const draft = await context.service.startDraft(unitId);
    await context.service.saveDraft(draft.applicationId, editorDefaults(information));
    await context.service.continueApplicantInformation(draft.applicationId);
    await context.service.continueResidenceHistory(draft.applicationId);
    const input = editorDefaults({ ...information, name: "Unfinished edit" });
    await context.service.saveDraft(draft.applicationId, input);
    expect((await context.service.getSummary(draft.applicationId)).hasUnfinishedEdits).toBe(true);
    await expect(
      context.service.submitApplication({ id: draft.applicationId, expectedVersion: "1" }),
    ).rejects.toThrow("unfinished edits");
  });

  it("cancels only proven-unsent creation chains on confirmed draft discard", async () => {
    context = setup();
    const draft = await context.service.startDraft(unitId);
    await context.service.saveDraft(draft.applicationId, editorDefaults(information));
    const create = await context.service.continueApplicantInformation(draft.applicationId);
    await context.service.continueResidenceHistory(draft.applicationId);
    await expect(context.service.discardLocalDraft(draft.applicationId, false)).rejects.toThrow(
      "Confirm",
    );
    await context.service.discardLocalDraft(draft.applicationId, true);
    expect(await context.service.getEditor(draft.applicationId)).toBeNull();
    expect((await context.operations.getAll()).map((o) => o.state)).toEqual([
      "Cancelled",
      "Cancelled",
    ]);
    expect(create.status).toBe("Pending");
  });

  it("does not submit an unaccepted snapshot after an immediate rejected save was removed", async () => {
    context = setup(true);
    const draft = await context.service.startDraft(unitId);
    await context.service.saveDraft(draft.applicationId, editorDefaults(information));
    await context.service.continueApplicantInformation(draft.applicationId);
    await context.service.continueResidenceHistory(draft.applicationId);
    await context.service.saveDraft(
      draft.applicationId,
      editorDefaults({ ...information, name: "Rejected change" }),
    );
    context.api.updateApplicationInformation.mockImplementation(async (_params, body) => {
      throw new HTTPError(422, { operationId: body.operationId, code: "InvalidInformation" }, {
        statusText: "",
      } as Response);
    });
    await expect(
      context.service.continueApplicantInformation(draft.applicationId),
    ).rejects.toThrow();
    expect(await context.service.getSummary(draft.applicationId)).toMatchObject({
      hasUnfinishedEdits: false,
      sectionsAccepted: false,
    });
    context.network.isOnline.mockResolvedValue(false);
    await expect(
      context.service.submitApplication({ id: draft.applicationId, expectedVersion: "2" }),
    ).rejects.toThrow("rejected or cancelled");
    expect(
      (await context.operations.getAll()).some(
        (operation) => operation.command === "SubmitApplication",
      ),
    ).toBe(false);
  });

  it("retains uncertain creation, frozen requests, and newer local input until receipt recovery", async () => {
    context = setup(true);
    const draft = await context.service.startDraft(unitId);
    await context.service.saveDraft(draft.applicationId, editorDefaults(information));
    context.api.createApplication.mockRejectedValueOnce(new NetworkError("response lost"));
    const result = await context.service.continueApplicantInformation(draft.applicationId);
    expect(result.status).toBe("Pending");
    const operation = (await context.operations.getAll())[0];
    expect(operation.state).toBe("Dispatched");
    await expect(context.service.discardLocalDraft(draft.applicationId, true)).rejects.toThrow(
      "reconciled",
    );
    await context.service.saveDraft(
      draft.applicationId,
      editorDefaults({ ...information, name: "New local input" }),
    );
    const response = {
      ...applicationDetail,
      application: { ...applicationDetail.application, id: draft.applicationId },
      operationId: operation.id,
      outcome: "Accepted",
      affectedResources: [{ resourceType: "Application", id: draft.applicationId, version: "1" }],
    };
    context.receipts.getOperation.mockResolvedValue({
      operationId: operation.id,
      outcome: "Accepted",
      httpStatus: 201,
      response,
      responseSchemaVersion: 1,
    });
    await context.operationsRepository.update(operation.id, { nextAttemptAt: null });
    await context.operations.processPending();
    expect(context.api.createApplication).toHaveBeenCalledTimes(1);
    expect((await context.operations.getAll())[0].frozenRequestJson).toBe(
      operation.frozenRequestJson,
    );
    expect(
      (await context.service.getEditor(draft.applicationId))?.input.applicantInformation.name,
    ).toBe("New local input");
    expect(
      (await context.repository.getDetail(draft.applicationId))?.applicantInformation.name,
    ).toBe(information.name);
  });

  it.each([401, 403, 422, 500])(
    "does not hide HTTP %s read errors with cached data",
    async (status) => {
      context = setup(true);
      await context.repository.saveDetail(applicationDetail);
      const error = new HTTPError(status, {}, { statusText: "" } as Response);
      context.api.getApplications.mockRejectedValue(error);
      await expect(context.service.getApplications()).rejects.toBe(error);
    },
  );

  it("labels transport fallback, includes applicant archived links, and rejects late session reads", async () => {
    context = setup(true);
    await context.repository.saveDetail({
      ...applicationDetail,
      application: { ...applicationDetail.application, isArchived: true },
    });
    context.api.getApplications.mockRejectedValue(new NetworkError("offline"));
    expect(await context.service.getApplications()).toMatchObject({
      source: "device",
      fallbackError: expect.any(NetworkError),
      data: { total: 1 },
    });
    await expect(context.service.getApplications({ showArchived: true })).rejects.toThrow(
      "showArchived",
    );
    context.api.getApplication.mockImplementation(async () => {
      context.scope.abort();
      return applicationDetail;
    });
    await expect(context.service.getApplication(applicationDetail.application.id)).rejects.toThrow(
      "no longer active",
    );
  });
});
