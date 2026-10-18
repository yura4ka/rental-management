import { ApplicationsRepository, applicationsQuery } from "./applicationsRepository";
import { testDatabase } from "./testing/testDatabase";
import {
  applicationDetail,
  applicationId,
  applicantId,
  propertyId,
  unitId,
} from "./testing/fixtures";

describe("ApplicationsRepository", () => {
  let database: ReturnType<typeof testDatabase>;
  let repository: ApplicationsRepository;
  beforeEach(() => {
    database = testDatabase();
    repository = new ApplicationsRepository(database.db);
  });
  afterEach(() => database.close());

  it("filters downloaded rows with role-specific archival and stable ordering", () => {
    expect(
      applicationsQuery(
        { status: "Draft", propertyId, sortBy: "statusChangedAt", sortDirection: "asc" },
        false,
        applicantId,
      ),
    ).toEqual({
      where: "WHERE applicantId = ? AND status = ? AND propertyId = ?",
      values: [applicantId, "Draft", propertyId],
      order: "statusChangedAt ASC, id ASC",
    });
    expect(applicationsQuery({}, true, applicantId).where).toBe("WHERE isArchived = 0");
    expect(applicationsQuery({ showArchived: true }, true, applicantId).where).toBe("");
  });

  it("keeps summaries separate from complete, older detail snapshots", async () => {
    await repository.savePage({
      rows: [applicationDetail.application],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(await repository.getDetail(applicationId)).toBeNull();
    await repository.saveDetail(applicationDetail);
    await repository.savePage({
      rows: [
        { ...applicationDetail.application, status: "Submitted", version: "9007199254740994" },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(await repository.getDetail(applicationId)).toMatchObject({
      ...applicationDetail,
      isOutdated: true,
    });
    await repository.saveDetail({
      ...applicationDetail,
      application: { ...applicationDetail.application, version: "9007199254740993" },
    });
    expect((await repository.getApplications()).rows[0].version).toBe("9007199254740994");
    expect((await repository.getDetail(applicationId))?.application.version).toBe(
      "9007199254740993",
    );
    await repository.saveDetail(applicationDetail);
    expect((await repository.getDetail(applicationId))?.application.version).toBe(
      "9007199254740993",
    );
  });

  it("replaces residences/history atomically and preserves never-saved versus saved-empty", async () => {
    await repository.saveDetail(applicationDetail);
    expect((await repository.getDetail(applicationId))?.residenceHistorySavedAt).toBeNull();
    const complete = {
      ...applicationDetail,
      application: { ...applicationDetail.application, version: "2" },
      residenceHistorySavedAt: "2026-01-02T12:00:00Z",
    };
    await repository.saveDetail(complete);
    expect(await repository.getDetail(applicationId)).toMatchObject({
      residenceHistorySavedAt: complete.residenceHistorySavedAt,
      residenceHistory: [],
    });
    await expect(
      repository.saveDetail({
        ...complete,
        application: { ...complete.application, version: "3" },
        history: [complete.history[0], complete.history[0]],
      }),
    ).rejects.toThrow();
    expect((await repository.getDetail(applicationId))?.application.version).toBe("2");
  });

  it("does not enforce server uniqueness on a partial cache and paginates in SQL", async () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({
      ...applicationDetail.application,
      id: `019c0000-0000-7000-8000-${String(i).padStart(12, "0")}`,
    }));
    await repository.savePage({ rows, total: 23, page: 1, pageSize: 20 });
    expect(await repository.getApplications({ page: 2 })).toMatchObject({
      total: 23,
      page: 2,
      pageSize: 20,
      rows: rows.slice(20),
    });
  });

  it("marks compact-acknowledged details outdated without synthesizing a denied snapshot", async () => {
    await repository.saveDetail(applicationDetail);
    await database.db.runAsync(
      "INSERT INTO operations (id, environmentGeneration, command, resourceType, resourceId, executionMode, intentJson, createdAt, updatedAt) VALUES ('batch', 'generation', 'RejectAllApplications', 'Unit', ?, 'Queued', '{}', 'now', 'now')",
      [unitId],
    );
    await database.db.runAsync(
      "INSERT INTO operation_affected_resources (operationId, resourceType, resourceId, version) VALUES ('batch', 'Application', ?, '2')",
      [applicationId],
    );
    expect(await repository.getDetail(applicationId)).toMatchObject({
      application: { status: "Draft", version: "1" },
      isOutdated: true,
    });
  });
});

it("keeps a manager's note independently versioned and invisible to applicants", async () => {
  const database = testDatabase("PropertyManager");
  try {
    const repository = new ApplicationsRepository(database.db);
    const note = {
      body: "private",
      createdAt: "now",
      updatedAt: "now",
      version: "9007199254740994",
    };
    await repository.saveDetail({ ...applicationDetail, myNote: note });
    await repository.saveDetail({
      ...applicationDetail,
      myNote: { ...note, body: "older", version: "9007199254740993" },
    });
    await repository.saveDetail(applicationDetail);
    expect((await repository.getDetail(applicationId))?.myNote).toEqual(note);
    await database.db.runAsync("UPDATE session_account SET role = 'Applicant', id = ?", [
      applicantId,
    ]);
    expect((await repository.getDetail(applicationId))?.myNote).toBeNull();
  } finally {
    database.close();
  }
});
