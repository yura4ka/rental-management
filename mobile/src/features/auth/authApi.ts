import type { HTTPTransport } from "@/services/api";
import type {
  GetCurrentAccountResponse,
  GetLogoutRequestParams,
  GetLogoutResponse,
  IAuthApi,
  LoginRequestBody,
  LoginResponse,
  LogoutRequestBody,
  LogoutResponse,
  RefreshRequestBody,
  RefreshResponse,
  SignupRequestBody,
  SignupResponse,
} from "./types";

export class AuthApi implements IAuthApi {
  constructor(private readonly api: HTTPTransport) {}

  signup(body: SignupRequestBody, signal?: AbortSignal): Promise<SignupResponse> {
    return this.api.fetch<SignupResponse>({
      url: "/api/auth/signup",
      method: "POST",
      body,
      signal,
    });
  }

  login(body: LoginRequestBody, signal?: AbortSignal): Promise<LoginResponse> {
    return this.api.fetch<LoginResponse>({ url: "/api/auth/login", method: "POST", body, signal });
  }

  refresh(body: RefreshRequestBody, signal?: AbortSignal): Promise<RefreshResponse> {
    return this.api.fetch<RefreshResponse>({
      url: "/api/auth/refresh",
      method: "POST",
      body,
      signal,
    });
  }

  getCurrentAccount(signal?: AbortSignal): Promise<GetCurrentAccountResponse> {
    return this.api.fetch<GetCurrentAccountResponse>({ url: "/api/auth/me", signal });
  }

  logout(body: LogoutRequestBody, signal?: AbortSignal): Promise<LogoutResponse> {
    return this.api.fetch<LogoutResponse>({
      url: "/api/auth/logout",
      method: "POST",
      body,
      signal,
    });
  }

  getLogout(params: GetLogoutRequestParams, signal?: AbortSignal): Promise<GetLogoutResponse> {
    return this.api.fetch<GetLogoutResponse>({
      url: `/api/auth/logout/${encodeURIComponent(params.operationId)}`,
      signal,
    });
  }
}
