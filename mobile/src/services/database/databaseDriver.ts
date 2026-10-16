import { openDatabaseAsync } from "expo-sqlite";
import { ExpoDatabaseConnection } from "./databaseConnection";
import { IDatabaseConnection, IDatabaseDriver } from "./types";

export class ExpoDatabaseDriver implements IDatabaseDriver {
  async open(name: string): Promise<IDatabaseConnection> {
    return new ExpoDatabaseConnection(await openDatabaseAsync(name, { useNewConnection: true }));
  }
}
