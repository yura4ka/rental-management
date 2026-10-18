import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import { InventoryRepository } from "@/features/inventory/inventoryRepository";
import type { GetUnitsRequestParams, GetUnitsResponse, UnitDto } from "./types";

export class UnitsRepository {
  private readonly inventory: InventoryRepository;

  constructor(private readonly db: ITransactionalDatabase) {
    this.inventory = new InventoryRepository(db);
  }

  async getUnits({
    propertyId,
    includeArchived = false,
    page = 1,
    pageSize = 20,
  }: GetUnitsRequestParams): Promise<GetUnitsResponse> {
    // Parent archival hides all units from active inventory, including stale downloaded children.
    const where = `WHERE u.propertyId = ? ${includeArchived ? "" : "AND u.archivedAt IS NULL AND p.archivedAt IS NULL"}`;
    const from =
      "FROM units u JOIN properties p ON p.id = u.propertyId JOIN owned_properties o ON o.propertyId = p.id";
    return this.db.withTransactionAsync(async (tx) => {
      const count = await tx.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total ${from} ${where}`,
        [propertyId],
      );
      const items = await tx.getAllAsync<UnitDto>(
        `SELECT u.id, u.propertyId, u.unitTypeId, u.number, u.bedrooms, u.monthlyRentCents, u.archivedAt, u.createdAt, u.updatedAt, u.version ${from} ${where} ORDER BY u.number, u.id LIMIT ? OFFSET ?`,
        [propertyId, pageSize, (page - 1) * pageSize],
      );
      return { items, totalCount: count?.total ?? 0, page, pageSize };
    });
  }

  save(unit: UnitDto, tx?: IDatabaseQueries): Promise<void> {
    return this.inventory.saveUnit(unit, tx);
  }

  async savePage(response: GetUnitsResponse): Promise<void> {
    await this.db.withTransactionAsync(async (tx) => {
      for (const unit of response.items) await this.save(unit, tx);
    });
  }
}
