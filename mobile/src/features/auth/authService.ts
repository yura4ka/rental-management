import { isOfflineError } from "@/services/api";
import type { INetwork } from "@/services/network/network";
import type { IAuthRepository } from "./authRepository";
import type {
  GetCurrentAccountResponse,
  IAuthApi,
  SignupRequestBody,
  SignupResponse,
} from "./types";

export class SessionMismatchError extends Error {
  constructor() {
    super("The account or server environment has changed.");
    this.name = "SessionMismatchError";
  }
}

export class AuthService {
  constructor(
    private readonly api: IAuthApi,
    private readonly repository: IAuthRepository,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
  ) {}

  register(body: SignupRequestBody, signal?: AbortSignal): Promise<SignupResponse> {
    this.assertActive();
    return this.api.signup(body, signal);
  }

  async getCurrentAccount(signal?: AbortSignal): Promise<GetCurrentAccountResponse> {
    this.assertActive();
    const cached = await this.repository.getCurrentAccount();
    if (!(await this.network.isOnline())) return this.requireCached(cached);
    this.assertActive();

    let account: GetCurrentAccountResponse;
    try {
      account = await this.api.getCurrentAccount(signal);
    } catch (error) {
      if (isOfflineError(error) && cached) return this.requireCached(cached);
      throw error;
    }
    this.assertActive();
    if (
      cached &&
      (cached.id !== account.id || cached.environmentGeneration !== account.environmentGeneration)
    ) {
      throw new SessionMismatchError();
    }
    await this.repository.saveCurrentAccount(account);
    return account;
  }

  private assertActive(): void {
    if (this.sessionSignal.aborted) throw new Error("The session is no longer active.");
  }

  private requireCached(account: GetCurrentAccountResponse | null): GetCurrentAccountResponse {
    this.assertActive();
    if (!account) throw new Error("No cached account is available.");
    return account;
  }
}
