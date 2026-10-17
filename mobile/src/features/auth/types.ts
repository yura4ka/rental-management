export type AccountRole = "Applicant" | "PropertyManager";

export type AccountDto = {
  id: string;
  email: string;
  role: AccountRole;
};

export type SignupRequestBody = {
  email: string | null;
  password: string | null;
  role: AccountRole | null;
};

export type SignupResponse = AccountDto;

export type LoginRequestBody = {
  email: string;
  password: string;
  twoFactorCode?: string | null;
  twoFactorRecoveryCode?: string | null;
};

export type TokenPairResponse = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
};

export type LoginResponse = TokenPairResponse;

export type RefreshRequestBody = {
  refreshToken: string;
};

export type RefreshResponse = TokenPairResponse;

export type GetCurrentAccountResponse = AccountDto & {
  environmentGeneration: string;
};

export type LogoutRequestBody = {
  operationId: string;
};

export type LogoutResponse = {
  operationId: string;
  outcome: string;
  acknowledgedAt: string | null;
};

export type GetLogoutRequestParams = {
  operationId: string;
};

export type GetLogoutResponse = LogoutResponse;

export interface IAuthApi {
  signup(body: SignupRequestBody, signal?: AbortSignal): Promise<SignupResponse>;
  login(body: LoginRequestBody, signal?: AbortSignal): Promise<LoginResponse>;
  refresh(body: RefreshRequestBody, signal?: AbortSignal): Promise<RefreshResponse>;
  getCurrentAccount(signal?: AbortSignal): Promise<GetCurrentAccountResponse>;
  logout(body: LogoutRequestBody, signal?: AbortSignal): Promise<LogoutResponse>;
  getLogout(params: GetLogoutRequestParams, signal?: AbortSignal): Promise<GetLogoutResponse>;
}
