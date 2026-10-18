import { CommandCatalog } from "@/features/operations/commandCatalog";
import { OperationsRepository } from "@/features/operations/operationsRepository";
import { OperationsService } from "@/features/operations/operationsService";
import { ApplicationsRepository } from "@/features/applications/applicationsRepository";
import { ApplicationEditorRepository } from "@/features/applications/applicationEditorRepository";
import { testDatabase } from "@/features/applications/testing/testDatabase";
import { applicationDetail, applicationId, unitId } from "@/features/applications/testing/fixtures";
import type { GetApplicationResponse } from "@/features/applications/types";
import type { INetwork } from "@/services/network";
import { ApplicationReviewsRepository } from "./applicationReviewsRepository";
import { ApplicationReviewsService } from "./applicationReviewsService";
import { createApplicationReviewHandlers } from "./operations/handlers";
import type {
  IApplicationReviewsApi,
  StartReviewRequestBody,
  ReturnApplicationRequestBody,
  SaveManagerNoteRequestBody,
  RejectAllApplicationsRequestBody,
} from "./types";

function setup(role: "Applicant" | "PropertyManager" = "PropertyManager") {
  const database = testDatabase(role);
  const applications = new ApplicationsRepository(database.db);
  const repository = new ApplicationReviewsRepository(database.db, applications);
  const network = { isOnline: jest.fn().mockResolvedValue(false) };
  const scope = new AbortController();
  let server: GetApplicationResponse = {
    ...applicationDetail,
    application: { ...applicationDetail.application, status: "Submitted" },
    residenceHistorySavedAt: "2026-01-01T00:00:00Z",
  };
  let noteVersion = 0n;
  const response = (operationId: string) => ({
    ...server,
    operationId,
    outcome: "Accepted" as const,
    affectedResources: [
      { resourceType: "Application", id: applicationId, version: server.application.version },
    ],
  });
  const api = {
    startReview: jest.fn(async (_params, body: StartReviewRequestBody) => {
      expect(body.expectedVersion).toBe(server.application.version);
      server = {
        ...server,
        application: { ...server.application, status: "InReview", version: "2" },
      };
      return response(body.operationId);
    }),
    returnApplication: jest.fn(async (_params, body: ReturnApplicationRequestBody) => {
      expect(body.expectedVersion).toBe("2");
      server = {
        ...server,
        application: { ...server.application, status: "Returned", version: "3" },
      };
      return response(body.operationId);
    }),
    releaseApplication: jest.fn(),
    denyApplication: jest.fn(),
    approveApplication: jest.fn(),
    saveManagerNote: jest.fn(async (_params, body: SaveManagerNoteRequestBody) => {
      expect(body.expectedVersion).toBe(noteVersion === 0n ? null : String(noteVersion));
      noteVersion++;
      return {
        body: body.body,
        version: String(noteVersion),
        createdAt: "now",
        updatedAt: "now",
        operationId: body.operationId,
        outcome: "Accepted" as const,
        affectedResources: [
          { resourceType: "ManagerNote", id: applicationId, version: String(noteVersion) },
        ],
      };
    }),
    rejectAllApplications: jest.fn(async (_params, body: RejectAllApplicationsRequestBody) => ({
      affectedCount: 1,
      operationId: body.operationId,
      outcome: "Accepted" as const,
      affectedResources: [{ resourceType: "Application", id: applicationId, version: "2" }],
    })),
  } satisfies IApplicationReviewsApi;
  const operations = new OperationsService(
    new OperationsRepository(database.db),
    { getOperation: jest.fn() },
    network as unknown as INetwork,
    scope.signal,
    async () => ({}),
    new CommandCatalog(createApplicationReviewHandlers(api, applications, repository)),
  );
  const service = new ApplicationReviewsService(
    applications,
    repository,
    operations as unknown as OperationsService,
    scope.signal,
  );
  return {
    ...database,
    applications,
    repository,
    network,
    api,
    operations,
    service,
    initial: server,
  };
}

describe("ApplicationReviewsService", () => {
  let context: ReturnType<typeof setup>;
  afterEach(() => context.close());

  it("does not start review on read, and chains explicit offline review and outcome actions", async () => {
    context = setup();
    await context.applications.saveDetail(context.initial);
    expect((await context.applications.getDetail(applicationId))?.application.status).toBe(
      "Submitted",
    );
    expect(await context.operations.getAll()).toEqual([]);
    await context.service.startReview({ id: applicationId, expectedVersion: "1" });
    await context.service.returnApplication({
      id: applicationId,
      expectedVersion: "1",
      comment: "Please correct",
    });
    await expect(
      context.service.denyApplication({ id: applicationId, expectedVersion: "1", comment: "No" }),
    ).rejects.toThrow("pending");
    context.network.isOnline.mockResolvedValue(true);
    await context.operations.processPending();
    expect((await context.operations.getAll()).map((o) => o.state)).toEqual([
      "Accepted",
      "Accepted",
    ]);
    expect((await context.applications.getDetail(applicationId))?.application).toMatchObject({
      status: "Returned",
      version: "3",
    });
  });

  it("queues independent notes with explicit null initially and clears to an empty body", async () => {
    context = setup();
    await context.applications.saveDetail(context.initial);
    await context.service.saveNoteDraft(applicationId, "unfinished note", null);
    expect(await context.operations.getAll()).toEqual([]);
    await context.service.startReview({ id: applicationId, expectedVersion: "1" });
    await context.service.saveManagerNote({
      id: applicationId,
      expectedVersion: null,
      body: "private",
    });
    await context.service.saveManagerNote({ id: applicationId, expectedVersion: null, body: "" });
    const pending = await context.operations.getAll();
    expect(pending[1].waitingOnOperationId).toBeNull();
    expect(pending[2].waitingOnOperationId).toBe(pending[1].id);
    context.network.isOnline.mockResolvedValue(true);
    await context.operations.processPending();
    expect((await context.applications.getDetail(applicationId))?.myNote).toMatchObject({
      body: "",
      version: "2",
    });
    expect((await context.applications.getDetail(applicationId))?.application.version).toBe("2");
    expect(await context.service.getNoteDraft(applicationId)).toEqual({
      body: "unfinished note",
      expectedVersion: "2",
    });
  });

  it("queues bulk rejection without captured IDs or expected versions and preserves old complete detail", async () => {
    context = setup();
    await context.applications.saveDetail(context.initial);
    await context.service.rejectAllApplications({ unitId, comment: "No vacancies" });
    const [operation] = await context.operations.getAll();
    expect(JSON.parse(operation.intentJson)).toEqual({ unitId, comment: "No vacancies" });
    context.network.isOnline.mockResolvedValue(true);
    await context.operations.processPending();
    expect(await context.applications.getDetail(applicationId)).toMatchObject({
      application: { status: "Submitted", version: "1" },
      isOutdated: true,
    });
    const editors = new ApplicationEditorRepository(context.db);
    // A pending unit batch also locks applicant editors, including local-only drafts.
    context.network.isOnline.mockResolvedValue(false);
    await context.service.rejectAllApplications({ unitId, comment: "Second batch" });
    const draft = await editors.create("other-applicant", unitId, "email@example.com");
    await expect(editors.saveInput(draft.applicationId, draft.input)).rejects.toThrow("pending");
  });

  it("allows private notes at terminal status but refuses review transitions", async () => {
    context = setup();
    await context.applications.saveDetail({
      ...context.initial,
      application: { ...context.initial.application, status: "Denied" },
    });
    await context.service.saveManagerNote({
      id: applicationId,
      expectedVersion: null,
      body: "archived record note",
    });
    await expect(
      context.service.startReview({ id: applicationId, expectedVersion: "1" }),
    ).rejects.toThrow("status");
  });

  it("persists server-issued lease dates on approval without changing other applications", async () => {
    context = setup();
    const reviewing = {
      ...context.initial,
      application: { ...context.initial.application, status: "InReview" as const },
    };
    const otherId = "019c0000-0000-7000-8000-000000000099";
    await context.applications.saveDetail(reviewing);
    await context.applications.saveDetail({
      ...context.initial,
      application: { ...context.initial.application, id: otherId },
      history: [],
    });
    const lease = {
      id: "server-lease",
      startDate: "2026-10-19T00:00:00Z",
      endDateExclusive: "2027-10-19T00:00:00Z",
      approvedAt: "2026-10-19T12:34:56Z",
    };
    context.api.approveApplication.mockImplementation(async (_params, body) => ({
      ...reviewing,
      application: { ...reviewing.application, status: "Approved", version: "2" },
      lease,
      operationId: body.operationId,
      outcome: "Accepted",
      affectedResources: [
        { resourceType: "Application", id: applicationId, version: "2" },
        { resourceType: "Lease", id: lease.id, version: null },
      ],
    }));
    await context.service.approveApplication({ id: applicationId, expectedVersion: "1" });
    context.network.isOnline.mockResolvedValue(true);
    await context.operations.processPending();
    expect((await context.applications.getDetail(applicationId))?.lease).toEqual(lease);
    expect((await context.applications.getDetail(otherId))?.application).toMatchObject({
      status: "Submitted",
      version: "1",
    });
  });

  it("refuses applicant access to note and review services", async () => {
    context = setup("Applicant");
    await context.applications.saveDetail(context.initial);
    await expect(
      context.service.saveManagerNote({ id: applicationId, expectedVersion: null, body: "secret" }),
    ).rejects.toThrow("Only managers");
    await expect(context.service.rejectAllApplications({ unitId, comment: "No" })).rejects.toThrow(
      "Only managers",
    );
  });
});
