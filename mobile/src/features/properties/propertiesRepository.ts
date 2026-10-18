import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import { InventoryRepository } from "@/features/inventory/inventoryRepository";
import type { GetPropertiesRequestParams, GetPropertiesResponse, PropertyDto } from "./types";

type PropertyRow = Omit<PropertyDto, "address"> & {
  addressDisplayName: string | null;
  addressStreetAddress: string | null;
  addressLine2: string | null;
};
const owned = "FROM properties p JOIN owned_properties o ON o.propertyId = p.id";
const columns =
  "p.id, p.displayAddress, p.archivedAt, p.createdAt, p.updatedAt, p.version, p.addressDisplayName, p.addressStreetAddress, p.addressLine2";

function toProperty(row: PropertyRow): PropertyDto {
  const { addressDisplayName, addressStreetAddress, addressLine2, ...property } = row;
  return {
    ...property,
    address: {
      displayName: addressDisplayName,
      streetAddress: addressStreetAddress,
      line2: addressLine2,
    },
  };
}

export class PropertiesRepository {
  private readonly inventory: InventoryRepository;

  constructor(private readonly db: ITransactionalDatabase) {
    this.inventory = new InventoryRepository(db);
  }

  async getProperties(params: GetPropertiesRequestParams = {}): Promise<GetPropertiesResponse> {
    const { page = 1, pageSize = 20, includeArchived = false } = params;
    const where = includeArchived ? "" : "WHERE p.archivedAt IS NULL";
    return this.db.withTransactionAsync(async (tx) => {
      const count = await tx.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total ${owned} ${where}`,
      );
      const rows = await tx.getAllAsync<PropertyRow>(
        `SELECT ${columns} ${owned} ${where} ORDER BY p.id LIMIT ? OFFSET ?`,
        [pageSize, (page - 1) * pageSize],
      );
      return { items: rows.map(toProperty), totalCount: count?.total ?? 0, page, pageSize };
    });
  }

  async get(id: string): Promise<PropertyDto | null> {
    const row = await this.db.getFirstAsync<PropertyRow>(
      `SELECT ${columns} ${owned} WHERE p.id = ?`,
      [id],
    );
    return row ? toProperty(row) : null;
  }

  async save(property: PropertyDto, tx?: IDatabaseQueries): Promise<void> {
    if (!tx) return this.db.withTransactionAsync((transaction) => this.save(property, transaction));
    await this.inventory.saveProperty(property, tx);
    await tx.runAsync("INSERT OR IGNORE INTO owned_properties (propertyId) VALUES (?)", [
      property.id,
    ]);
  }

  async savePage(response: GetPropertiesResponse): Promise<void> {
    await this.db.withTransactionAsync(async (tx) => {
      for (const property of response.items) await this.save(property, tx);
    });
  }
}
