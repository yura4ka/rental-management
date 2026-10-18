import type { QueryClient } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";
import { AuthApi } from "@/features/auth/authApi";
import { AuthRepository } from "@/features/auth/authRepository";
import { SessionMismatchError } from "@/features/auth/authService";
import type { GetCurrentAccountResponse, LoginRequestBody } from "@/features/auth/types";
import { HTTPError, isOfflineError, type HTTPTransport } from "@/services/api";
import type { Database } from "@/services/database";
import type { INetwork } from "@/services/network";
import type { IKeyStorage, ITokenStorage } from "@/services/secureStorage";
import { createServices, type SessionServices } from "./createServices";

export type SessionStatus = "not-ready" | "unauthenticated" | "authenticated";

export type SessionState = {
  status: SessionStatus;
  account: GetCurrentAccountResponse | null;
  error: unknown;
  isBusy: boolean;
};

export class Session {
  readonly store = createStore<SessionState>(() => ({
    status: "not-ready",
    account: null,
    error: null,
    isBusy: false,
  }));

  private readonly authApi: AuthApi;
  private readonly authRepository: AuthRepository;
  private services: SessionServices | null = null;
  private serviceScope: AbortController | null = null;
  private initializing: Promise<SessionStatus> | null = null;
  private signingOut: Promise<void> | null = null;

  constructor(
    private readonly tokenStorage: ITokenStorage,
    private readonly keyStorage: IKeyStorage,
    private readonly db: Database,
    private readonly api: HTTPTransport,
    readonly queryClient: QueryClient,
    private readonly network: INetwork,
  ) {
    this.authApi = new AuthApi(api);
    this.authRepository = new AuthRepository(db);
  }

  get status(): SessionStatus {
    return this.store.getState().status;
  }

  get account(): GetCurrentAccountResponse | null {
    return this.store.getState().account;
  }

  getService<K extends keyof SessionServices>(name: K): SessionServices[K] {
    if (this.status !== "authenticated" || !this.services) {
      throw new Error("The session is not authenticated.");
    }
    return this.services[name];
  }

  init(): Promise<SessionStatus> {
    if (this.initializing) return this.initializing;
    if (this.status !== "not-ready") return Promise.resolve(this.status);
    this.initializing = this.runOperation(() => this.initialize()).finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  login(body: LoginRequestBody): Promise<SessionStatus> {
    if (this.status !== "unauthenticated") {
      return Promise.reject(new Error("Initialize the session and sign out before logging in."));
    }
    return this.runOperation(async () => {
      try {
        const pair = await this.authApi.login(body);
        await this.clearStorage();
        await this.tokenStorage.setTokens({
          ...pair,
          accessTokenExpiresAt: Date.now() + pair.expiresIn * 1000,
        });
        const key = await this.keyStorage.generateKey();
        await this.db.openAsync(key);
        await this.db.runMigrationsAsync();
        const services = this.createScopedServices();
        const account = await services.auth.getCurrentAccount();
        this.authenticate(account, services);
        return this.status;
      } catch (error) {
        await this.invalidate(error);
        throw error;
      }
    });
  }

  signOut(_reason?: "session-expired"): Promise<void> {
    if (this.signingOut) return this.signingOut;
    this.signingOut = this.runOperation(() => this.invalidate())
      .then(() => undefined)
      .finally(() => {
        this.signingOut = null;
      });
    return this.signingOut;
  }

  private async initialize(): Promise<SessionStatus> {
    try {
      const [key, tokens] = await Promise.all([
        this.keyStorage.getKey(),
        this.tokenStorage.getTokens(),
      ]);
      if (!key || !tokens || !(await this.db.existsAsync())) return await this.invalidate();
      try {
        await this.db.openAsync(key);
      } catch (error) {
        return await this.invalidate(error);
      }
      await this.db.runMigrationsAsync();
      const cached = await this.authRepository.getCurrentAccount();
      if (!cached) return await this.invalidate();

      const services = this.createScopedServices();
      let account = cached;
      if (await this.network.isOnline()) {
        try {
          await this.api.refresh(tokens);
          account = await services.auth.getCurrentAccount();
        } catch (error) {
          if (!isOfflineError(error)) {
            if (
              error instanceof SessionMismatchError ||
              (error instanceof HTTPError && [400, 401, 403].includes(error.status))
            ) {
              return await this.invalidate(error);
            }
            throw error;
          }
        }
      }
      this.authenticate(account, services);
      return this.status;
    } catch (error) {
      this.serviceScope?.abort();
      await this.db.closeAsync();
      throw error;
    }
  }

  private createScopedServices(): SessionServices {
    this.serviceScope?.abort();
    this.serviceScope = new AbortController();
    return createServices({
      api: this.api,
      db: this.db,
      network: this.network,
      sessionSignal: this.serviceScope.signal,
    });
  }

  private authenticate(account: GetCurrentAccountResponse, services: SessionServices): void {
    this.services = services;
    this.store.setState({ status: "authenticated", account, error: null });
  }

  private async invalidate(error: unknown = null): Promise<SessionStatus> {
    this.serviceScope?.abort();
    this.services = null;
    this.store.setState({ status: "unauthenticated", account: null, error });
    await this.clearStorage();
    return this.status;
  }

  private async clearStorage(): Promise<void> {
    await this.queryClient.cancelQueries();
    this.queryClient.clear();
    await this.api.resetSession();
    const results = await Promise.allSettled([
      this.db.deleteAsync(),
      this.tokenStorage.removeTokens(),
      this.keyStorage.removeKey(),
    ]);
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
  }

  private async runOperation<T>(task: () => Promise<T>): Promise<T> {
    if (this.store.getState().isBusy)
      throw new Error("A session operation is already in progress.");
    this.store.setState({ isBusy: true, error: null });
    try {
      return await task();
    } catch (error) {
      this.store.setState({ error });
      throw error;
    } finally {
      this.store.setState({ isBusy: false });
    }
  }
}
