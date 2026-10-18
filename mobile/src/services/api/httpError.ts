/** Keeps native Problem Details (or an empty response) without rewriting it. */
export class HTTPError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly response: Response,
  ) {
    super(`HTTP ${status}${response.statusText ? ` ${response.statusText}` : ""}`);
    this.name = "HTTPError";
  }
}
