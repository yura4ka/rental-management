import { HTTPError } from "@/services/api";
import { getApiErrorMessage, getFieldErrors, isValidationError } from "./errorUtils";

function httpError(body: unknown) {
  return new HTTPError(422, body, { statusText: "Unprocessable Entity" } as Response);
}

describe("API validation errors", () => {
  const error = httpError({
    code: "ValidationFailed",
    title: "Validation failed.",
    validation: {
      fields: { Email: "Email is already registered", role: "Select a role", other: "Ignore" },
    },
  });

  it("recognizes the backend Problem Details shape", () => {
    expect(isValidationError(error)).toBe(true);
    expect(getApiErrorMessage(error)).toBe("Validation failed.");
  });

  it("prefers a specific detail and ignores empty messages", () => {
    expect(
      getApiErrorMessage(
        httpError({ code: "ValidationFailed", detail: " Specific error ", title: "Validation" }),
      ),
    ).toBe("Specific error");
    expect(getApiErrorMessage(httpError({ code: "ValidationFailed", title: " " }))).toBe(
      "Unknown error",
    );
  });

  it.each([
    null,
    undefined,
    new Error("Private detail"),
    httpError({ title: "Server error" }),
    httpError({ validation: { fields: { email: 123 } } }),
  ])("safely rejects non-validation or malformed errors: %p", (value) => {
    expect(isValidationError(value)).toBe(false);
    expect(getApiErrorMessage(value)).toBe("Unknown error");
    expect(getFieldErrors(value, ["email"])).toEqual({});
  });

  it("maps only known fields, case insensitively", () => {
    expect(getFieldErrors(error, ["email", "password", "role"])).toEqual({
      email: "Email is already registered",
      role: "Select a role",
    });
  });

  it("supports native ASP.NET validation message arrays", () => {
    const native = httpError({
      title: "Validation failed",
      errors: { Password: ["Too short", "Invalid"] },
    });
    expect(isValidationError(native)).toBe(true);
    expect(getFieldErrors(native, ["password"])).toEqual({ password: "Too short\nInvalid" });
  });
});
