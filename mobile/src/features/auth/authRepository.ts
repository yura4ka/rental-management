import type { IDatabaseQueries } from "@/services/database/types";
import type { GetCurrentAccountResponse } from "./types";

export interface IAuthRepository {
  getCurrentAccount(): Promise<GetCurrentAccountResponse | null>;
  saveCurrentAccount(account: GetCurrentAccountResponse): Promise<void>;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly db: IDatabaseQueries) {}

  getCurrentAccount(): Promise<GetCurrentAccountResponse | null> {
    return this.db.getFirstAsync<GetCurrentAccountResponse>(
      "SELECT id, email, role, environmentGeneration FROM session_account WHERE singleton = 1",
    );
  }

  async saveCurrentAccount(account: GetCurrentAccountResponse): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO session_account (singleton, id, email, role, environmentGeneration)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET
         id = excluded.id, email = excluded.email, role = excluded.role,
         environmentGeneration = excluded.environmentGeneration`,
      [account.id, account.email, account.role, account.environmentGeneration],
    );
  }
}
