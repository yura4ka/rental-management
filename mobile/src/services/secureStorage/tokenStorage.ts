import { TokenPairResponse } from "@/features/auth/types";
import { ISecureStorage } from "./secureStorage";

export type StoredTokens = TokenPairResponse & {
  /** Unix time in milliseconds, derived from expiresIn. */
  accessTokenExpiresAt: number;
};

export interface ITokenStorage {
  getTokens(): Promise<StoredTokens | null>;
  setTokens(tokens: StoredTokens): Promise<void>;
}

export class TokenStorage {
  constructor(private readonly secureStorage: ISecureStorage) {}

  async getTokens(): Promise<StoredTokens | null> {
    try {
      const tokensString = await this.secureStorage.getItem("tokens");
      return tokensString ? JSON.parse(tokensString) : null;
    } catch {
      return null;
    }
  }

  setTokens(tokens: StoredTokens): Promise<void> {
    return this.secureStorage.setItem("tokens", JSON.stringify(tokens));
  }
}
