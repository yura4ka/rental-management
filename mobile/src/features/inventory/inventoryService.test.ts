import { HTTPError, NetworkError } from "@/services/api";
import type { INetwork } from "@/services/network";
import type { InventoryRepository } from "./inventoryRepository";
import { InventoryService } from "./inventoryService";
import { availablePage, availableUnit } from "./testing/fixtures";

function setup() {
  const api = {
    getAvailableUnits: jest.fn().mockResolvedValue(availablePage),
    getUnitTypes: jest.fn().mockResolvedValue([availableUnit.unitType]),
  };
  const repository = {
    getAvailableUnits: jest.fn().mockResolvedValue(availablePage),
    getUnitTypes: jest.fn().mockResolvedValue([availableUnit.unitType]),
    saveAvailableUnits: jest.fn(),
    saveUnitTypes: jest.fn(),
  };
  const network = { isOnline: jest.fn().mockResolvedValue(true) };
  const scope = new AbortController();
  const service = new InventoryService(
    api,
    repository as unknown as InventoryRepository,
    network as unknown as INetwork,
    scope.signal,
  );
  return { api, repository, network, scope, service };
}

describe("InventoryService", () => {
  it("persists online pages before returning the server result", async () => {
    const { service, repository, api } = setup();
    const params = { bedrooms: 2, priceFrom: 100, page: 3 };
    await expect(service.getAvailableUnits(params)).resolves.toEqual({
      data: availablePage,
      source: "server",
    });
    expect(api.getAvailableUnits).toHaveBeenCalledWith(params, expect.any(AbortSignal));
    expect(repository.saveAvailableUnits).toHaveBeenCalledWith(availablePage, params);
  });
  it("queries downloaded records with any requested filters offline", async () => {
    const { service, repository, api, network } = setup();
    network.isOnline.mockResolvedValue(false);
    const params = {
      bedrooms: 3,
      sortBy: "price" as const,
      sortDirection: "desc" as const,
      page: 2,
    };
    await expect(service.getAvailableUnits(params)).resolves.toEqual({
      data: availablePage,
      source: "device",
    });
    expect(repository.getAvailableUnits).toHaveBeenCalledWith(params);
    expect(api.getAvailableUnits).not.toHaveBeenCalled();
  });
  it.each([
    new NetworkError("offline"),
    ...[502, 503, 504].map((status) => new HTTPError(status, {}, { statusText: "" } as Response)),
  ])("labels allowed read fallback and preserves its failure context", async (error) => {
    const { service, api } = setup();
    api.getAvailableUnits.mockRejectedValue(error);
    await expect(service.getAvailableUnits()).resolves.toEqual({
      data: availablePage,
      source: "device",
      fallbackError: error,
    });
  });
  it.each([401, 403, 422, 500])("never masks HTTP %s with downloaded data", async (status) => {
    const { service, api, repository } = setup();
    const error = new HTTPError(status, {}, { statusText: "" } as Response);
    api.getAvailableUnits.mockRejectedValue(error);
    await expect(service.getAvailableUnits()).rejects.toBe(error);
    expect(repository.getAvailableUnits).not.toHaveBeenCalled();
  });
  it("does not reclassify a persistence failure after server success as transport failure", async () => {
    const { service, repository } = setup();
    repository.saveAvailableUnits.mockRejectedValue(new NetworkError("disk"));
    await expect(service.getAvailableUnits()).rejects.toThrow();
    expect(repository.getAvailableUnits).not.toHaveBeenCalled();
  });
  it("rejects late responses after session cancellation without writing", async () => {
    const { service, api, repository, scope } = setup();
    api.getAvailableUnits.mockImplementation(async () => {
      scope.abort();
      return availablePage;
    });
    await expect(service.getAvailableUnits()).rejects.toThrow("no longer active");
    expect(repository.saveAvailableUnits).not.toHaveBeenCalled();
  });
  it("honors query cancellation and persists unit type lookups", async () => {
    const { service, api, repository } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(service.getAvailableUnits({}, controller.signal)).rejects.toThrow(
      "no longer active",
    );
    expect(api.getAvailableUnits).not.toHaveBeenCalled();
    await expect(service.getUnitTypes()).resolves.toEqual({
      data: [availableUnit.unitType],
      source: "server",
    });
    expect(repository.saveUnitTypes).toHaveBeenCalledWith([availableUnit.unitType]);
  });
});
