import { HTTPError } from "./httpError";

export class NetworkError extends Error {
  constructor(public readonly cause: unknown) {
    super("The server could not be reached.");
    this.name = "NetworkError";
  }
}

export function isOfflineError(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof HTTPError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}
