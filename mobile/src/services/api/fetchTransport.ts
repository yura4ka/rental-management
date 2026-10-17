import { ITokenStorage, StoredTokens } from "@/services/secureStorage";
import { TokenPairResponse } from "@/features/auth/types";
import { HTTPError } from "./httpError";
import type { HTTPRequest, HTTPTransport, ILogoutManager } from "./types";

function abortError(): Error {
  const error = new Error("The request was aborted.");
  error.name = "AbortError";
  return error;
}

/** Stop waiting without aborting an operation shared with other callers. */
function waitFor<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) reject(abortError());
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export class FetchTransport implements HTTPTransport {
  private readonly baseUrl: URL;
  private refreshing: Promise<StoredTokens> | null = null;
  private failedSession: { tokens: StoredTokens | null; error: unknown } | null = null;

  constructor(
    baseUrl: string,
    private readonly tokenStorage: ITokenStorage,
    private readonly logoutManager: ILogoutManager,
  ) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  fetch = async <T>(request: HTTPRequest): Promise<T> => {
    if (request.signal?.aborted) throw abortError();
    const url = this.buildUrl(request);
    const isAuthRequest = ["/api/auth/login", "/api/auth/refresh"].includes(url.pathname);
    const body = this.prepareBody(request);
    let tokens = isAuthRequest
      ? null
      : await waitFor(this.tokenStorage.getTokens(), request.signal);
    let refreshed = false;

    if (!isAuthRequest) {
      this.checkSession(tokens);
      if (tokens && tokens.accessTokenExpiresAt <= Date.now()) {
        tokens = await waitFor(this.refresh(tokens), request.signal);
        refreshed = true;
      }
    }

    let response = await this.send(url, request, body, tokens);
    if (response.status === 401 && !isAuthRequest && !refreshed) {
      tokens = await waitFor(this.refresh(tokens), request.signal);
      response = await this.send(url, request, body, tokens);
    }
    return this.readResponse<T>(response);
  };

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

  private send(
    url: URL,
    request: HTTPRequest,
    body: string | undefined,
    tokens: StoredTokens | null,
  ): Promise<Response> {
    if (request.signal?.aborted) return Promise.reject(abortError());
    return globalThis.fetch(url.toString(), {
      method: request.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
      body,
      signal: request.signal,
      credentials: "omit",
    });
  }

  private checkSession(tokens: StoredTokens | null): void {
    if (!this.failedSession) return;
    const failed = this.failedSession.tokens;
    if (
      !tokens ||
      (tokens.accessToken === failed?.accessToken && tokens.refreshToken === failed?.refreshToken)
    ) {
      throw this.failedSession.error;
    }
    // A subsequent login supplied a new pair.
    this.failedSession = null;
  }

  private refresh(previous: StoredTokens | null): Promise<StoredTokens> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.performRefresh(previous).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async performRefresh(previous: StoredTokens | null): Promise<StoredTokens> {
    let current = previous;
    try {
      current = await this.tokenStorage.getTokens();
      this.checkSession(current);
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
      );
      const pair = await this.readResponse<TokenPairResponse>(response);
      const tokens = { ...pair, accessTokenExpiresAt: Date.now() + pair.expiresIn * 1000 };
      await this.tokenStorage.setTokens(tokens);
      return tokens;
    } catch (error) {
      if (!this.failedSession) {
        this.failedSession = { tokens: current, error };
        // Preserve the refresh error even if the logout coordinator also fails.
        try {
          await this.logoutManager.signOut("session-expired");
        } catch {
          // Logout owns its cleanup/recovery policy.
        }
      }
      throw error;
    }
  }

  private async readResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
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
