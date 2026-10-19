import type { IDatabaseQueries, ITransactionalDatabase, SqlValue } from "@/services/database/types";
import { migrations } from "@/services/database/migrations";
import { applicantId, managerId, generation } from "./fixtures";

// Keep Node-only test types out of the Expo application's compiler configuration.
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      get(...params: SqlValue[]): unknown;
      all(...params: SqlValue[]): unknown[];
      run(...params: SqlValue[]): { changes: number; lastInsertRowid: number };
    };
  };
}>("node:sqlite");

/** Real in-memory SQLite validates migrations, foreign keys, and transactional writers. */
export function testDatabase(role: "Applicant" | "PropertyManager" = "Applicant") {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) for (const sql of migration) sqlite.exec(sql);
  const db: ITransactionalDatabase = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async runAsync(sql, params = []) {
      const result = sqlite.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async withTransactionAsync<T>(task: (tx: IDatabaseQueries) => Promise<T>) {
      sqlite.exec("BEGIN");
      try {
        const result = await task(db);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  sqlite
    .prepare(
      "INSERT INTO session_account (singleton, id, email, role, environmentGeneration) VALUES (1, ?, ?, ?, ?)",
    )
    .run(role === "Applicant" ? applicantId : managerId, "login@example.com", role, generation);
  return { db, close: () => sqlite.close() };
}
