import { Routes } from "@/app/navigation/routes";
import { canClearOperation, operationStatus, operationTarget } from "./presentation";
import type { OperationListItem } from "./types";

// Presentation only reads this subset of journal fields.
function operation(overrides: Partial<OperationListItem> = {}) {
  return {
    state: "Queued",
    firstDispatchedAt: null,
    command: "SubmitApplication",
    resourceType: "Application",
    resourceId: "application",
    intentJson: "{}",
    ...overrides,
  } as OperationListItem;
}

it("only offers cancellation for proven-unsent work or clearing for final rejection", () => {
  expect(canClearOperation(operation())).toBe(true);
  expect(canClearOperation(operation({ firstDispatchedAt: "2026-01-01" }))).toBe(false);
  for (const state of ["Dispatched", "Accepted", "Cancelled"] as const) {
    expect(canClearOperation(operation({ state }))).toBe(false);
  }
  expect(canClearOperation(operation({ state: "Rejected", firstDispatchedAt: "2026-01-01" }))).toBe(
    true,
  );
});

it("keeps waiting and blocked labels separate from durable lifecycle states", () => {
  expect(operationStatus(operation({ blockedByOperationId: "failed" }))).toBe("Queued");
  expect(operationStatus(operation({ state: "Dispatched" }))).toContain("awaiting confirmation");
  expect(operationStatus(operation({ state: "Accepted" }))).toBe("Success");
  expect(operationStatus(operation({ state: "Rejected" }))).toBe("Failed");
});

it("resolves supported resource destinations without inventing missing unit parents", () => {
  expect(operationTarget(operation())).toEqual({
    screen: Routes.ApplicationDetails,
    applicationId: "application",
  });
  expect(operationTarget(operation({ command: "CreateApplication" }))).toEqual({
    screen: Routes.ApplicationForm,
    applicationId: "application",
  });
  expect(operationTarget(operation({ resourceType: "Profile" }))).toEqual({
    screen: Routes.Profile,
  });
  expect(operationTarget(operation({ resourceType: "ManagerNote" }))).toEqual({
    screen: Routes.ApplicationDetails,
    applicationId: "application",
  });
  const propertyId = "00000000-0000-4000-8000-000000000001";
  expect(
    operationTarget(
      operation({ resourceType: "Unit", intentJson: JSON.stringify({ propertyId }) }),
    ),
  ).toEqual({ screen: Routes.PropertyDetails, propertyId });
  expect(operationTarget(operation({ resourceType: "Unit", intentJson: "malformed" }))).toBeNull();
  expect(operationTarget(operation({ resourceType: "Unknown" }))).toBeNull();
});
