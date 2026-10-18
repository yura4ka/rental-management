import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import { PropertiesRepository } from "@/features/properties/propertiesRepository";
import { UnitsRepository } from "@/features/units/unitsRepository";
import type { JournalOperation } from "@/features/operations/types";
import { saveInventoryIntent } from "./saveInventoryIntent";
import { availableUnit } from "./testing/fixtures";

function database() {
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
  return db;
}

it("only lists owned properties offline, with stable subset pagination and archive filtering", async () => {
  const db = database();
  const repository = new PropertiesRepository(db as ITransactionalDatabase);
  await repository.getProperties({ page: 2, pageSize: 3 });
  expect(db.getAllAsync).toHaveBeenCalledWith(
    expect.stringMatching(
      /JOIN owned_properties.*WHERE p.archivedAt IS NULL.*ORDER BY p.id LIMIT \? OFFSET \?/,
    ),
    [3, 3],
  );
  db.getAllAsync.mockClear();
  await repository.getProperties({ includeArchived: true });
  expect(db.getAllAsync.mock.calls[0][0]).not.toContain("archivedAt IS NULL");
});

it("does not overwrite newer accepted inventory with an old receipt or nest writer transactions", async () => {
  const db = database();
  db.getFirstAsync.mockResolvedValue({ version: "9007199254740994" });
  await new PropertiesRepository(db).save(availableUnit.property, db);
  await new UnitsRepository(db).save(availableUnit.unit, db);
  expect(db.withTransactionAsync).not.toHaveBeenCalled();
  expect(db.runAsync.mock.calls.some(([sql]) => /INSERT INTO (properties|units)\b/.test(sql))).toBe(
    false,
  );
});

it("excludes units under archived parents from active offline inventory", async () => {
  const db = database();
  await new UnitsRepository(db).getUnits({ propertyId: "property", page: 2, pageSize: 5 });
  expect(db.getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining("AND u.archivedAt IS NULL AND p.archivedAt IS NULL"),
    ["property", 5, 5],
  );
});

it("links the submitted snapshot to the journal using the supplied transaction and original version", async () => {
  const db = database();
  await saveInventoryIntent(
    {
      id: "operation",
      resourceId: "unit",
      resourceType: "Unit",
      command: "UpdateUnit",
      intentJson: JSON.stringify({ expectedVersion: "9007199254740993", number: "A1" }),
      createdAt: "now",
    } as JournalOperation,
    db,
  );
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO local_forms"),
    expect.arrayContaining(["9007199254740993"]),
  );
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO operation_snapshots"),
    ["operation", expect.any(String)],
  );
  expect(db.withTransactionAsync).not.toHaveBeenCalled();
});
