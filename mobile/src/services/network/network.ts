import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export interface INetwork {
  isOnline(): Promise<boolean>;
}

export class Network implements INetwork {
  private online = false;
  private initialized = false;
  private checking: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  get isInitialized(): boolean {
    return this.initialized;
  }

  getSnapshot = (): boolean => this.online;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): () => void {
    return NetInfo.addEventListener((state) => this.update(state));
  }

  async isOnline(): Promise<boolean> {
    if (!this.initialized) return this.online;

    this.checking ??= NetInfo.fetch()
      .then((state) => {
        if (!this.initialized) this.update(state);
      })
      .catch(() => {
        if (!this.initialized) this.publish(false);
      })
      .finally(() => {
        this.checking = null;
      });
    await this.checking;
    return this.online;
  }

  private update(state: NetInfoState): void {
    this.publish(state.isConnected === true && state.isInternetReachable !== false);
  }

  private publish(online: boolean): void {
    if (this.initialized && this.online === online) return;
    this.online = online;
    this.initialized = true;
    this.listeners.forEach((listener) => listener());
  }
}

export const network = new Network();
