import { HTTPError, NetworkError } from "@/services/api";
import type { INetwork } from "@/services/network";
import type { OperationsService } from "@/features/operations/operationsService";
import { availableUnit } from "@/features/inventory/testing/fixtures";
import type { PropertiesRepository } from "./propertiesRepository";
import { PropertiesService } from "./propertiesService";

function setup() {
  const page = { items: [availableUnit.property], totalCount: 1, page: 1, pageSize: 20 };
  const api = {
    getProperties: jest.fn().mockResolvedValue(page),
    createProperty: jest.fn(),
    updateProperty: jest.fn(),
    archiveProperty: jest.fn(),
  };
  const repository = {
    getProperties: jest.fn().mockResolvedValue(page),
    get: jest.fn().mockResolvedValue(availableUnit.property),
    savePage: jest.fn(),
    save: jest.fn(),
  };
  const network = { isOnline: jest.fn().mockResolvedValue(true) };
  const scope = new AbortController();
  const service = new PropertiesService(
    api,
    repository as unknown as PropertiesRepository,
    {} as OperationsService,
    network as unknown as INetwork,
    scope.signal,
  );
  return { page, api, repository, network, scope, service };
}

it("persists online reads and uses downloaded subset queries offline", async () => {
  const { page, service, repository, network } = setup();
  await expect(service.getProperties()).resolves.toEqual({ data: page, source: "server" });
  expect(repository.savePage).toHaveBeenCalledWith(page);
  network.isOnline.mockResolvedValue(false);
  await expect(service.getProperties({ includeArchived: true, page: 2 })).resolves.toEqual({
    data: page,
    source: "device",
  });
  expect(repository.getProperties).toHaveBeenCalledWith({ includeArchived: true, page: 2 });
});

it("labels transport fallback but never masks authorization or server errors", async () => {
  const { service, api, repository } = setup();
  const error = new NetworkError("offline");
  api.getProperties.mockRejectedValue(error);
  expect(await service.getProperties()).toMatchObject({ source: "device", fallbackError: error });
  repository.getProperties.mockClear();
  for (const status of [401, 403, 500]) {
    const failure = new HTTPError(status, {}, { statusText: "" } as Response);
    api.getProperties.mockRejectedValue(failure);
    await expect(service.getProperties()).rejects.toBe(failure);
  }
  expect(repository.getProperties).not.toHaveBeenCalled();
});

it("resolves property details across owned-list pages without inventing a detail endpoint", async () => {
  const { service, api, repository } = setup();
  api.getProperties.mockResolvedValueOnce({ items: [], totalCount: 101, page: 1, pageSize: 100 });
  await expect(service.getProperty("property")).resolves.toEqual({
    data: availableUnit.property,
    source: "server",
  });
  expect(api.getProperties).toHaveBeenLastCalledWith(
    { includeArchived: true, page: 2, pageSize: 100 },
    expect.any(AbortSignal),
  );
  expect(repository.save).toHaveBeenCalledWith(availableUnit.property);
});

it("never persists a late response after session cancellation", async () => {
  const { page, service, api, repository, scope } = setup();
  api.getProperties.mockImplementation(async () => {
    scope.abort();
    return page;
  });
  await expect(service.getProperties()).rejects.toThrow("no longer active");
  expect(repository.savePage).not.toHaveBeenCalled();
});
