import { SQLiteDatabase } from "expo-sqlite";
import { IDatabaseConnection, SqlResult, SqlValue } from "./types";

export class ExpoDatabaseConnection implements IDatabaseConnection {
  constructor(private readonly database: SQLiteDatabase) {}

  execAsync(sql: string): Promise<void> {
    return this.database.execAsync(sql);
  }

  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null> {
    return params
      ? this.database.getFirstAsync<T>(sql, params)
      : this.database.getFirstAsync<T>(sql);
  }

  getAllAsync<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, params);
  }

  runAsync(sql: string, params: SqlValue[] = []): Promise<SqlResult> {
    return this.database.runAsync(sql, params);
  }

  withTransactionAsync(task: () => Promise<void>): Promise<void> {
    return this.database.withTransactionAsync(task);
  }

  isInTransactionAsync(): Promise<boolean> {
    return this.database.isInTransactionAsync();
  }

  closeAsync(): Promise<void> {
    return this.database.closeAsync();
  }
}
