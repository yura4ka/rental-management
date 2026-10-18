import type { IDatabaseQueries, ITransactionalDatabase, SqlValue } from "@/services/database/types";
import type {
  AvailableUnitDto,
  GetAvailableUnitsRequestParams,
  GetAvailableUnitsResponse,
  UnitTypeDto,
} from "./types";
import type { PropertyDto } from "../properties/types";
import type { UnitDto } from "../units/types";

type AvailableRow = UnitDto & {
  addressDisplayName: string | null;
  addressStreetAddress: string | null;
  addressLine2: string | null;
  displayAddress: string;
  propertyCreatedAt: string;
  propertyUpdatedAt: string;
  propertyVersion: string;
  typeCode: string;
  typeName: string;
  typeIsActive: number;
  typeVersion: string;
};

const joins = `FROM available_units a JOIN units u ON u.id = a.unitId
  JOIN properties p ON p.id = u.propertyId JOIN unit_types t ON t.id = u.unitTypeId`;

export function availableUnitsQuery(params: GetAvailableUnitsRequestParams) {
  const clauses = ["p.archivedAt IS NULL", "u.archivedAt IS NULL"];
  const values: SqlValue[] = [];
  if (params.unitTypeIds?.length) {
    clauses.push(`u.unitTypeId IN (${params.unitTypeIds.map(() => "?").join(",")})`);
    values.push(...params.unitTypeIds);
  }
  for (const [value, column, operator] of [
    [params.bedrooms, "u.bedrooms", "="],
    [params.priceFrom, "u.monthlyRentCents", ">="],
    [params.priceTo, "u.monthlyRentCents", "<="],
  ] as const) {
    if (value !== undefined) {
      clauses.push(`${column} ${operator} ?`);
      values.push(value);
    }
  }
  const direction = params.sortDirection === "desc" ? "DESC" : "ASC";
  const order =
    params.sortBy === "price"
      ? `u.monthlyRentCents ${direction}`
      : params.sortBy === "createdAt"
        ? `u.createdAt ${direction}`
        : "p.id ASC, u.number ASC";
  return { where: `WHERE ${clauses.join(" AND ")}`, values, order: `${order}, u.id ASC` };
}

export class InventoryRepository {
  constructor(private readonly db: ITransactionalDatabase) {}

  async getAvailableUnits(
    params: GetAvailableUnitsRequestParams = {},
  ): Promise<GetAvailableUnitsResponse> {
    const { where, values, order } = availableUnitsQuery(params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    return this.db.withTransactionAsync(async (tx) => {
      const count = await tx.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total ${joins} ${where}`,
        values,
      );
      const rows = await tx.getAllAsync<AvailableRow>(
        `SELECT u.*,
        p.addressDisplayName, p.addressStreetAddress, p.addressLine2, p.displayAddress,
        p.createdAt AS propertyCreatedAt, p.updatedAt AS propertyUpdatedAt, p.version AS propertyVersion,
        t.code AS typeCode, t.name AS typeName, t.isActive AS typeIsActive, t.version AS typeVersion
        ${joins} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [...values, pageSize, (page - 1) * pageSize],
      );
      return { items: rows.map(toAvailableUnit), totalCount: count?.total ?? 0, page, pageSize };
    });
  }

  async getUnitTypes(): Promise<UnitTypeDto[]> {
    const rows = await this.db.getAllAsync<Omit<UnitTypeDto, "isActive"> & { isActive: number }>(
      "SELECT id, code, name, isActive, version FROM unit_types ORDER BY name, id",
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  }

  async saveAvailableUnits(
    response: GetAvailableUnitsResponse,
    params: GetAvailableUnitsRequestParams = {},
    tx?: IDatabaseQueries,
  ): Promise<void> {
    if (!tx)
      return this.db.withTransactionAsync((transaction) =>
        this.saveAvailableUnits(response, params, transaction),
      );
    // Only a complete response can prove that matching downloaded records are no longer available.
    // A partial page must never evict records downloaded on other pages.
    if (response.page === 1 && response.items.length === response.totalCount) {
      const { where, values } = availableUnitsQuery(params);
      const ids = response.items.map((item) => item.unit.id);
      await tx.runAsync(
        `DELETE FROM available_units WHERE unitId IN (SELECT u.id ${joins} ${where})
        ${ids.length ? `AND unitId NOT IN (${ids.map(() => "?").join(",")})` : ""}`,
        [...values, ...ids],
      );
    }
    for (const item of response.items) {
      const { address, ...property } = item.property;
      await this.upsert(
        "properties",
        {
          ...property,
          addressDisplayName: address.displayName,
          addressStreetAddress: address.streetAddress,
          addressLine2: address.line2,
        },
        tx,
      );
      await this.saveUnitTypes([item.unitType], tx);
      await this.upsert("units", item.unit, tx);
      await tx.runAsync(
        `INSERT INTO available_units (unitId, fetchedAt) VALUES (?, ?)
        ON CONFLICT(unitId) DO UPDATE SET fetchedAt = excluded.fetchedAt`,
        [item.unit.id, new Date().toISOString()],
      );
    }
  }

  async saveUnitTypes(types: UnitTypeDto[], tx?: IDatabaseQueries): Promise<void> {
    if (!tx)
      return this.db.withTransactionAsync((transaction) => this.saveUnitTypes(types, transaction));
    for (const type of types)
      await this.upsert("unit_types", { ...type, isActive: type.isActive ? 1 : 0 }, tx);
  }

  // Whitelist identifiers: HTTP responses may contain fields outside the TypeScript DTO.
  private async upsert(
    table: "properties" | "units" | "unit_types",
    record: Record<string, SqlValue>,
    tx: IDatabaseQueries,
  ) {
    if (typeof record.version !== "string" || !/^[1-9]\d*$/.test(record.version))
      throw new Error("Invalid inventory version.");
    const previous = await tx.getFirstAsync<{ version: string }>(
      `SELECT version FROM ${table} WHERE id = ?`,
      [record.id],
    );
    if (previous && BigInt(previous.version) > BigInt(record.version)) return;
    const columns = {
      properties: [
        "id",
        "addressDisplayName",
        "addressStreetAddress",
        "addressLine2",
        "displayAddress",
        "archivedAt",
        "createdAt",
        "updatedAt",
        "version",
      ],
      units: [
        "id",
        "propertyId",
        "unitTypeId",
        "number",
        "bedrooms",
        "monthlyRentCents",
        "archivedAt",
        "createdAt",
        "updatedAt",
        "version",
      ],
      unit_types: ["id", "code", "name", "isActive", "version"],
    };
    const keys = [...columns[table], "fetchedAt"];
    const data: Record<string, SqlValue> = { ...record, fetchedAt: new Date().toISOString() };
    await tx.runAsync(
      `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})
      ON CONFLICT(id) DO UPDATE SET ${keys
        .filter((key) => key !== "id")
        .map((key) => `${key} = excluded.${key}`)
        .join(", ")}`,
      keys.map((key) => data[key]),
    );
  }
}

function toAvailableUnit(row: AvailableRow): AvailableUnitDto {
  const property: PropertyDto = {
    id: row.propertyId,
    address: {
      displayName: row.addressDisplayName,
      streetAddress: row.addressStreetAddress,
      line2: row.addressLine2,
    },
    displayAddress: row.displayAddress,
    archivedAt: null,
    createdAt: row.propertyCreatedAt,
    updatedAt: row.propertyUpdatedAt,
    version: row.propertyVersion,
  };
  const unit: UnitDto = {
    id: row.id,
    propertyId: row.propertyId,
    unitTypeId: row.unitTypeId,
    number: row.number,
    bedrooms: row.bedrooms,
    monthlyRentCents: row.monthlyRentCents,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
  return {
    property,
    unit,
    unitType: {
      id: row.unitTypeId,
      code: row.typeCode,
      name: row.typeName,
      isActive: Boolean(row.typeIsActive),
      version: row.typeVersion,
    },
  };
}
