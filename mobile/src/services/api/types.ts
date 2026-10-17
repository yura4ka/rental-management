import { StoredTokens } from "@/services/secureStorage";

export interface ILogoutManager {
  signOut(reason: "session-expired"): void | Promise<void>;
}

export type QueryParam = string | number | boolean | null | undefined;

export interface HTTPRequest {
  /** A URL relative to baseUrl, or an absolute URL. */
  url: string;
  params?: Record<string, QueryParam | readonly QueryParam[]>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  /** JSON-serializable request body. */
  body?: unknown;
  signal?: AbortSignal;
}

export interface HTTPTransport {
  fetch<T>(request: HTTPRequest): Promise<T>;
  refresh(previous: StoredTokens | null): Promise<StoredTokens>;
  resetSession(): Promise<void>;
}
