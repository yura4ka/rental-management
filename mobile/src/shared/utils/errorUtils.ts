import { HTTPError } from "@/services/api";

type ValidationProblem = {
  code?: string;
  title?: string;
  detail?: string;
  validation?: { fields: Record<string, string> };
  errors?: Record<string, string[]>;
};

export type ValidationError = HTTPError & { body: ValidationProblem };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidationError(error: unknown): error is ValidationError {
  if (!(error instanceof HTTPError) || !isRecord(error.body)) return false;
  const { body } = error;
  if (body.title !== undefined && typeof body.title !== "string") return false;
  if (body.detail !== undefined && typeof body.detail !== "string") return false;
  if (body.code !== undefined && typeof body.code !== "string") return false;
  if (
    body.validation !== undefined &&
    (!isRecord(body.validation) ||
      !isRecord(body.validation.fields) ||
      !Object.values(body.validation.fields).every((value) => typeof value === "string"))
  )
    return false;
  if (
    body.errors !== undefined &&
    (!isRecord(body.errors) ||
      !Object.values(body.errors).every(
        (value) => Array.isArray(value) && value.every((message) => typeof message === "string"),
      ))
  )
    return false;
  return (
    body.code === "ValidationFailed" || body.validation !== undefined || body.errors !== undefined
  );
}

export function getApiErrorMessage(error: unknown): string {
  if (!isValidationError(error)) return "Unknown error";
  return error.body.detail?.trim() || error.body.title?.trim() || "Unknown error";
}

/** Only map known form fields; unknown server paths must not mutate form state. */
export function getFieldErrors<T extends string>(
  error: unknown,
  fields: readonly T[],
): Partial<Record<T, string>> {
  if (!isValidationError(error)) return {};
  const messages = error.body.validation?.fields ?? error.body.errors ?? {};
  const result: Partial<Record<T, string>> = {};
  for (const field of fields) {
    const key = Object.keys(messages).find((key) => key.toLowerCase() === field.toLowerCase());
    const message = key === undefined ? undefined : messages[key];
    const text = Array.isArray(message) ? message.join("\n") : message;
    if (text) result[field] = text;
  }
  return result;
}
