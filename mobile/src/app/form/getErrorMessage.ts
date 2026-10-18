/** Supports both validator strings and Standard Schema issues (for example, Zod). */
export function getErrorMessage(errors: readonly unknown[]): string | undefined {
  const messages = errors.flatMap((error) => {
    if (typeof error === "string") return error ? [error] : [];
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message ? [error.message] : [];
    }
    return [];
  });

  return [...new Set(messages)].join("\n") || undefined;
}
