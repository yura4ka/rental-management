import { Platform } from "react-native";
import { ITokenStorage, StoredTokens } from "@/services/secureStorage";
import { TokenPairResponse } from "@/features/auth/types";
import { HTTPError } from "./httpError";
import { NetworkError } from "./networkError";
import type { HTTPRequest, HTTPTransport, ILogoutManager } from "./types";

function abortError(): Error {
  const error = new Error("The request was aborted.");
  error.name = "AbortError";
  return error;
}

type TransportResponse = { response: Response; text: string };

export class FetchTransport implements HTTPTransport {
  private readonly baseUrl: URL;
  private refreshing: Promise<StoredTokens> | null = null;
  private sessionError: HTTPError | null = null;
  private sessionScope = new AbortController();

  constructor(
    baseUrl: string,
    private readonly tokenStorage: ITokenStorage,
    private readonly logoutManager: ILogoutManager,
    isAndroidEmulator = false,
  ) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

    if (isAndroidEmulator && Platform.OS === "android" && this.baseUrl.hostname === "localhost") {
      this.baseUrl.hostname = "10.0.2.2";
    }
  }

  fetch = async <T>(request: HTTPRequest): Promise<T> => {
    const sessionSignal = this.sessionScope.signal;
    if (sessionSignal.aborted || request.signal?.aborted) throw abortError();

    const url = this.buildUrl(request);
    const isAuthRequest = ["/api/auth/signup", "/api/auth/login", "/api/auth/refresh"].includes(
      url.pathname,
    );
    const body = this.prepareBody(request);
    let tokens = isAuthRequest ? null : await this.tokenStorage.getTokens();
    let refreshed = false;

    if (!isAuthRequest) {
      if (sessionSignal.aborted) throw abortError();
      if (this.sessionError) throw this.sessionError;
      if (tokens && tokens.accessTokenExpiresAt <= Date.now()) {
        tokens = await this.refresh(tokens);
        refreshed = true;
      }
    }

    let response = await this.send(url, request, body, tokens, sessionSignal);
    if (response.response.status === 401 && !isAuthRequest && !refreshed) {
      if (sessionSignal.aborted) throw abortError();
      tokens = await this.refresh(tokens);
      response = await this.send(url, request, body, tokens, sessionSignal);
    }
    return this.readResponse<T>(response);
  };

  refresh(previous: StoredTokens | null): Promise<StoredTokens> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.performRefresh(previous).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async resetSession(): Promise<void> {
    this.sessionScope.abort();
    await this.refreshing?.catch(() => undefined);
    this.sessionScope = new AbortController();
    this.sessionError = null;
  }

  private buildUrl(request: HTTPRequest): URL {
    const url = new URL(request.url, this.baseUrl);
    for (const [key, value] of Object.entries(request.params ?? {})) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== null && item !== undefined) url.searchParams.append(key, String(item));
      }
    }
    return url;
  }

  private prepareBody(request: HTTPRequest): string | undefined {
    return request.body === undefined ? undefined : JSON.stringify(request.body);
  }

  private async send(
    url: URL,
    request: HTTPRequest,
    body: string | undefined,
    tokens: StoredTokens | null,
    sessionSignal: AbortSignal,
  ): Promise<TransportResponse> {
    if (request.signal?.aborted || sessionSignal.aborted) throw abortError();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onAbort, { once: true });
    sessionSignal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await globalThis.fetch(url.toString(), {
        method: request.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        },
        body,
        signal: controller.signal,
        credentials: "omit",
      });
      return { response, text: await response.text() };
    } catch (error) {
      if (request.signal?.aborted || sessionSignal.aborted) throw abortError();
      throw new NetworkError(error);
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", onAbort);
      sessionSignal.removeEventListener("abort", onAbort);
    }
  }

  private async performRefresh(previous: StoredTokens | null): Promise<StoredTokens> {
    const sessionSignal = this.sessionScope.signal;
    try {
      const current = await this.tokenStorage.getTokens();
      if (sessionSignal.aborted) throw abortError();
      if (this.sessionError) throw this.sessionError;
      // A late 401 can arrive after another request has already refreshed the pair.
      if (
        current &&
        current.accessToken !== previous?.accessToken &&
        current.accessTokenExpiresAt > Date.now()
      ) {
        return current;
      }
      if (!current?.refreshToken) throw new Error("No refresh token is available.");
      const response = await this.send(
        new URL("/api/auth/refresh", this.baseUrl),
        { url: "/api/auth/refresh", method: "POST" },
        JSON.stringify({ refreshToken: current.refreshToken }),
        null,
        sessionSignal,
      );
      const pair = await this.readResponse<TokenPairResponse>(response);
      if (sessionSignal.aborted) throw abortError();

      const tokens = { ...pair, accessTokenExpiresAt: Date.now() + pair.expiresIn * 1000 };
      await this.tokenStorage.setTokens(tokens);
      return tokens;
    } catch (error) {
      if (
        error instanceof HTTPError &&
        [400, 401, 403].includes(error.status) &&
        !sessionSignal.aborted &&
        !this.sessionError
      ) {
        this.sessionError = error;
        // Cleanup waits for refresh to finish, so do not await it from this request.
        void Promise.resolve()
          .then(() => {
            if (!sessionSignal.aborted) return this.logoutManager.signOut("session-expired");
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async readResponse<T>({ response, text }: TransportResponse): Promise<T> {
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) throw new HTTPError(response.status, body, response);
    return body as T;
  }
}
