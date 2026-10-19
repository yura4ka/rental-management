import { TokenPairResponse } from "@/features/auth/types";
import { ISecureStorage } from "./secureStorage";

export type StoredTokens = TokenPairResponse & {
  /** Unix time in milliseconds, derived from expiresIn. */
  accessTokenExpiresAt: number;
};

export interface ITokenStorage {
  getTokens(): Promise<StoredTokens | null>;
  setTokens(tokens: StoredTokens): Promise<void>;
  removeTokens(): Promise<void>;
}

export class TokenStorage implements ITokenStorage {
  constructor(private readonly secureStorage: ISecureStorage) {}

  async getTokens(): Promise<StoredTokens | null> {
    try {
      const tokensString = await this.secureStorage.getItem("tokens");
      if (!tokensString) return null;
      const tokens: StoredTokens | null = JSON.parse(tokensString);
      if (
        !tokens ||
        typeof tokens.accessToken !== "string" ||
        !tokens.accessToken ||
        typeof tokens.refreshToken !== "string" ||
        !tokens.refreshToken ||
        typeof tokens.accessTokenExpiresAt !== "number" ||
        !Number.isFinite(tokens.accessTokenExpiresAt)
      ) {
        return null;
      }
      return tokens;
    } catch {
      return null;
    }
  }

  setTokens(tokens: StoredTokens): Promise<void> {
    return this.secureStorage.setItem("tokens", JSON.stringify(tokens));
  }

  removeTokens(): Promise<void> {
    return this.secureStorage.removeItem("tokens");
  }
}
