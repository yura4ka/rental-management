import { getRecentApplications } from "./recentApplications";
import { applicationDetail } from "./testing/fixtures";
import type { ApplicationDto } from "./types";

function application(id: string, day: number): ApplicationDto {
  return {
    ...applicationDetail.application,
    id,
    statusChangedAt: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
  };
}

function page(rows: ApplicationDto[], source = "server") {
  return { data: { rows, total: rows.length, page: 1, pageSize: 20 }, source };
}

it("requests an applicant's first page sorted by latest status change and returns only three", async () => {
  const applications = {
    getApplications: jest
      .fn()
      .mockResolvedValue(
        page([application("a", 5), application("b", 4), application("c", 3), application("d", 2)]),
      ),
  };
  const signal = new AbortController().signal;
  const result = await getRecentApplications(applications, null, signal);
  expect(applications.getApplications).toHaveBeenCalledWith(
    { sortBy: "statusChangedAt", sortDirection: "desc" },
    signal,
  );
  expect(result.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  expect(result.offline).toBe(false);
});

it("reads every owned property page and merges only owned applications with deterministic ties", async () => {
  const properties = {
    getProperties: jest
      .fn()
      .mockResolvedValueOnce({
        data: { items: [{ id: "p1" }], totalCount: 2, pageSize: 1 },
        source: "server",
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: "p2" }], totalCount: 2, pageSize: 1 },
        source: "device",
      }),
  };
  const applications = {
    getApplications: jest
      .fn()
      .mockResolvedValueOnce(page([application("d", 6), application("b", 4), application("c", 3)]))
      .mockResolvedValueOnce({
        ...page([application("a", 6), application("e", 5)], "device"),
        fallbackError: new Error("offline"),
      }),
  };
  const result = await getRecentApplications(applications, properties);
  expect(properties.getProperties).toHaveBeenCalledTimes(2);
  expect(properties.getProperties.mock.calls[1][0].page).toBe(2);
  expect(applications.getApplications.mock.calls.map(([params]) => params.propertyId)).toEqual([
    "p1",
    "p2",
  ]);
  expect(applications.getApplications.mock.calls.every(([params]) => params.showArchived)).toBe(
    true,
  );
  expect(result.items.map((item) => item.id)).toEqual(["a", "d", "e"]);
  expect(result.offline).toBe(true);
  expect(result.fallback).toBe(true);
});

it("returns an empty manager list without querying unrelated applications when there are no owned properties", async () => {
  const properties = {
    getProperties: jest
      .fn()
      .mockResolvedValue({ data: { items: [], totalCount: 0, pageSize: 100 }, source: "server" }),
  };
  const applications = { getApplications: jest.fn() };
  expect((await getRecentApplications(applications, properties)).items).toEqual([]);
  expect(applications.getApplications).not.toHaveBeenCalled();
});

it("does not hide a failed ownership or application read as an empty result", async () => {
  const applications = { getApplications: jest.fn().mockRejectedValue(new Error("forbidden")) };
  await expect(getRecentApplications(applications, null)).rejects.toThrow("forbidden");
});
