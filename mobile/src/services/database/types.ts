export type SqlValue = string | number | null;
export type SqlResult = { changes: number; lastInsertRowId: number };

export interface IDatabaseQueries {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  runAsync(sql: string, params?: SqlValue[]): Promise<SqlResult>;
}

export interface IDatabaseConnection extends IDatabaseQueries {
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  isInTransactionAsync(): Promise<boolean>;
  closeAsync(): Promise<void>;
}

export interface IDatabaseDriver {
  open(name: string): Promise<IDatabaseConnection>;
  exists(name: string): Promise<boolean>;
  delete(name: string): Promise<void>;
}
