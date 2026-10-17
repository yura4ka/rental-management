import { File } from "expo-file-system";
import { defaultDatabaseDirectory, deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import { ExpoDatabaseConnection } from "./databaseConnection";
import { IDatabaseConnection, IDatabaseDriver } from "./types";

export class ExpoDatabaseDriver implements IDatabaseDriver {
  async exists(name: string): Promise<boolean> {
    return new File(defaultDatabaseDirectory, name).exists;
  }

  async delete(name: string): Promise<void> {
    if (await this.exists(name)) await deleteDatabaseAsync(name);
  }

  async open(name: string): Promise<IDatabaseConnection> {
    return new ExpoDatabaseConnection(await openDatabaseAsync(name, { useNewConnection: true }));
  }
}
