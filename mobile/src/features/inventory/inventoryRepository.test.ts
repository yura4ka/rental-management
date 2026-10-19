import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import { availableUnitsQuery, InventoryRepository } from "./inventoryRepository";
import { availablePage, availableUnit } from "./testing/fixtures";

function setup() {
  const db = {
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    execAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
  };
  db.withTransactionAsync.mockImplementation((task: (tx: IDatabaseQueries) => Promise<unknown>) =>
    task(db),
  );
  return { db, repository: new InventoryRepository(db as ITransactionalDatabase) };
}

describe("InventoryRepository", () => {
  it("builds parameterized subset filters and stable sorting", () => {
    expect(
      availableUnitsQuery({
        unitTypeIds: ["a", "b"],
        bedrooms: 2,
        priceFrom: 0,
        priceTo: 120055,
        sortBy: "price",
        sortDirection: "desc",
      }),
    ).toEqual({
      where:
        "WHERE p.archivedAt IS NULL AND u.archivedAt IS NULL AND u.unitTypeId IN (?,?) AND u.bedrooms = ? AND u.monthlyRentCents >= ? AND u.monthlyRentCents <= ?",
      values: ["a", "b", 2, 0, 120055],
      order: "u.monthlyRentCents DESC, u.id ASC",
    });
  });
  it("counts and paginates in one transaction rather than loading every cached record", async () => {
    const { db, repository } = setup();
    db.getFirstAsync.mockResolvedValue({ total: 8 });
    await expect(repository.getAvailableUnits({ page: 2, pageSize: 3 })).resolves.toEqual({
      items: [],
      totalCount: 8,
      page: 2,
      pageSize: 3,
    });
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT ? OFFSET ?"),
      [3, 3],
    );
  });
  it("saves normalized snapshots and membership atomically without nested transactions", async () => {
    const { db, repository } = setup();
    await repository.saveAvailableUnits(availablePage);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    for (const table of ["properties", "units", "unit_types", "available_units"])
      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining(`INSERT INTO ${table}`),
        expect.any(Array),
      );
  });
  it("protects exact versions beyond Number precision and ignores unexpected response fields", async () => {
    const { db, repository } = setup();
    db.getFirstAsync.mockResolvedValue({ version: "9007199254740994" });
    await repository.saveAvailableUnits(availablePage);
    expect(
      db.runAsync.mock.calls.filter(([sql]) =>
        /INSERT INTO (properties|units|unit_types)\b/.test(sql),
      ),
    ).toHaveLength(0);
    db.runAsync.mockClear();
    db.getFirstAsync.mockResolvedValue(null);
    await repository.saveUnitTypes([
      { ...availableUnit.unitType, unexpected: "bad" } as typeof availableUnit.unitType,
    ]);
    expect(db.runAsync.mock.calls[0][0]).not.toContain("unexpected");
  });
  it("only removes absent cached availability when a matching query response is complete", async () => {
    const { db, repository } = setup();
    await repository.saveAvailableUnits({ ...availablePage, totalCount: 100 });
    expect(db.runAsync.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(false);
    db.runAsync.mockClear();
    await repository.saveAvailableUnits(
      { ...availablePage, items: [], totalCount: 0 },
      { bedrooms: 3 },
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM available_units"),
      [3],
    );
  });
});
