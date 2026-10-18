import { getRandomBytesAsync } from "expo-crypto";
import type { ISecureStorage } from "./secureStorage";

export interface IKeyStorage {
  getKey(): Promise<string | null>;
  generateKey(): Promise<string>;
  removeKey(): Promise<void>;
}

export class KeyStorage implements IKeyStorage {
  constructor(private readonly secureStorage: ISecureStorage) {}

  getKey(): Promise<string | null> {
    return this.secureStorage.getItem("databaseKey");
  }

  async generateKey(): Promise<string> {
    const bytes = await getRandomBytesAsync(32);
    const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await this.secureStorage.setItem("databaseKey", key);
    return key;
  }

  removeKey(): Promise<void> {
    return this.secureStorage.removeItem("databaseKey");
  }
}
