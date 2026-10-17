import { currentVersion, migrations } from "./migrations";
import type {
  IDatabaseConnection,
  IDatabaseDriver,
  IDatabaseQueries,
  SqlResult,
  SqlValue,
} from "./types";

const databaseName = "rental_management_db";

export class Database implements IDatabaseQueries {
  private reader: IDatabaseConnection | null = null;
  private writer: IDatabaseConnection | null = null;
  private state: "closed" | "opening" | "open" | "closing" = "closed";
  private opening: Promise<void> | null = null;
  private closing: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly operations = new Set<Promise<unknown>>();

  constructor(private readonly driver: IDatabaseDriver) {}

  existsAsync(): Promise<boolean> {
    return this.driver.exists(databaseName);
  }

  async deleteAsync(): Promise<void> {
    await this.closeAsync();
    await this.driver.delete(databaseName);
  }

  async runMigrationsAsync(): Promise<void> {
    await this.withTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      const version = row?.user_version ?? 0;
      if (version > currentVersion) throw new Error("The database requires a newer app version.");
      for (let index = version; index < currentVersion; index++) {
        for (const sql of migrations[index]) {
          await tx.execAsync(sql);
        }
        await tx.execAsync(`PRAGMA user_version = ${index + 1};`);
      }
    });
  }

  openAsync(key: string): Promise<void> {
    if (this.state === "closing") {
      return Promise.reject(new Error("Database is closing."));
    }
    if (this.state === "open") return Promise.resolve();
    if (this.opening) return this.opening;

    this.state = "opening";
    this.opening = this.openConnections(key).finally(() => {
      this.opening = null;
    });
    return this.opening;
  }

  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null> {
    return this.execute(() => this.reader!.getFirstAsync<T>(sql, params));
  }

  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]> {
    return this.execute(() => this.reader!.getAllAsync<T>(sql, params));
  }

  runAsync(sql: string, params?: SqlValue[]): Promise<SqlResult> {
    return this.execute(() => this.enqueueWrite(() => this.writer!.runAsync(sql, params)));
  }

  execAsync(sql: string): Promise<void> {
    return this.execute(() => this.enqueueWrite(() => this.writer!.execAsync(sql)));
  }

  withTransactionAsync<T>(task: (tx: IDatabaseQueries) => Promise<T>): Promise<T> {
    return this.execute(() =>
      this.enqueueWrite(async () => {
        const writer = this.writer!;
        let result!: T;
        await writer.withTransactionAsync(async () => {
          let active = true;
          const query = async <R>(operation: () => Promise<R>): Promise<R> => {
            if (!active) throw new Error("Transaction scope is no longer active.");
            return operation();
          };
          const tx: IDatabaseQueries = {
            execAsync: (sql) => query(() => writer.execAsync(sql)),
            runAsync: (sql, params) => query(() => writer.runAsync(sql, params)),
            getFirstAsync: <R>(sql: string, params?: SqlValue[]) =>
              query(() => writer.getFirstAsync<R>(sql, params)),
            getAllAsync: <R>(sql: string, params?: SqlValue[]) =>
              query(() => writer.getAllAsync<R>(sql, params)),
          };
          try {
            result = await task(tx);
          } finally {
            active = false;
          }
        });
        return result;
      }),
    );
  }

  closeAsync(): Promise<void> {
    if (this.closing) return this.closing;
    if (this.state === "closed") return Promise.resolve();

    this.state = "closing";
    this.closing = this.closeConnections().finally(() => {
      this.state = "closed";
      this.closing = null;
    });
    return this.closing;
  }

  private async openConnections(key: string): Promise<void> {
    let writer: IDatabaseConnection | null = null;
    let reader: IDatabaseConnection | null = null;
    try {
      const pragmas = `PRAGMA key = '${key.replace(/'/g, "''")}';
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;`;

      writer = await this.driver.open(databaseName);
      await writer.execAsync(pragmas);
      await writer.getFirstAsync("SELECT count(*) FROM sqlite_master");
      reader = await this.driver.open(databaseName);
      await reader.execAsync(pragmas);
      await reader.execAsync("PRAGMA query_only = ON;");

      this.writer = writer;
      this.reader = reader;
      if (this.state === "opening") this.state = "open";
    } catch (error) {
      await Promise.allSettled([this.closeConnection(reader), this.closeConnection(writer)]);
      if (this.state === "opening") this.state = "closed";
      throw error;
    }
  }

  private async closeConnections(): Promise<void> {
    await this.opening?.catch(() => undefined);
    await Promise.allSettled([...this.operations]);
    const results = await Promise.allSettled([
      this.closeConnection(this.reader),
      this.closeConnection(this.writer),
    ]);
    this.reader = null;
    this.writer = null;
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
  }

  private async closeConnection(connection: IDatabaseConnection | null): Promise<void> {
    await connection?.closeAsync();
  }

  private execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.state !== "open") {
      return Promise.reject(new Error("Database is not open. Await openAsync() before querying."));
    }
    const operation = Promise.resolve().then(task);
    this.operations.add(operation);
    const remove = () => {
      this.operations.delete(operation);
    };
    operation.then(remove, remove);
    return operation;
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const operation = this.writeQueue.then(task);
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
