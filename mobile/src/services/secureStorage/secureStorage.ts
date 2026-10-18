import * as SecureStore from "expo-secure-store";

const options: SecureStore.SecureStoreOptions = {
  keychainService: "rental_management.secrets",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

export type SecretSlotKey = "tokens" | "databaseKey";

export interface ISecureStorage {
  getItem(key: SecretSlotKey): Promise<string | null>;
  setItem(key: SecretSlotKey, value: string): Promise<void>;
  removeItem(key: SecretSlotKey): Promise<void>;
}

export class SecureStorage implements ISecureStorage {
  getItem(key: SecretSlotKey): Promise<string | null> {
    return SecureStore.getItemAsync(key, options);
  }
  setItem(key: SecretSlotKey, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value, options);
  }
  removeItem(key: SecretSlotKey): Promise<void> {
    return SecureStore.deleteItemAsync(key, options);
  }
}
