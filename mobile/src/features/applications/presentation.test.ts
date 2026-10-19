import type { OperationListItem } from "@/features/operations/types";
import {
  availableApplicationActions,
  applicationActionOperations,
  reviewCommentFormSchema,
  toApplicationParams,
} from "./presentation";

it("limits review actions to the owner and legal nonterminal statuses", () => {
  expect(availableApplicationActions("Submitted", false, true, false).review).toEqual([
    "startReview",
  ]);
  expect(availableApplicationActions("InReview", false, true, false).review).toEqual([
    "release",
    "return",
    "deny",
    "approve",
  ]);
  expect(availableApplicationActions("InReview", false, false, false).review).toEqual([]);
  for (const status of ["Draft", "Returned", "Approved", "Denied", "Withdrawn"] as const) {
    expect(availableApplicationActions(status, false, true, false).review).toEqual([]);
  }
  expect(availableApplicationActions("InReview", false, true, true).review).toEqual([]);
});

it("allows applicants to edit drafts/returns and withdraw only open applications", () => {
  for (const status of ["Draft", "Returned"] as const) {
    expect(availableApplicationActions(status, true, false, false)).toMatchObject({
      edit: true,
      withdraw: true,
    });
  }
  expect(availableApplicationActions("Submitted", true, false, false)).toMatchObject({
    edit: false,
    withdraw: true,
  });
  for (const status of ["Approved", "Denied", "Withdrawn"] as const) {
    expect(availableApplicationActions(status, true, false, false)).toMatchObject({
      edit: false,
      withdraw: false,
    });
  }
  expect(availableApplicationActions("Draft", true, false, true)).toEqual({
    edit: false,
    withdraw: false,
    review: [],
  });
});

it("requires nonblank return/reject comments but allows blank approval comments", () => {
  expect(reviewCommentFormSchema(true).safeParse({ comment: " \n " }).success).toBe(false);
  expect(
    reviewCommentFormSchema(true).safeParse({ comment: "Please correct the address." }).success,
  ).toBe(true);
  expect(reviewCommentFormSchema(false).safeParse({ comment: "" }).success).toBe(true);
  expect(reviewCommentFormSchema(false).safeParse({ comment: "x".repeat(2001) }).success).toBe(
    false,
  );
});

it("locks application and unit-wide actions, not independent private notes or resolved work", () => {
  const operation = (overrides: Partial<OperationListItem>) =>
    ({
      resourceType: "Application",
      resourceId: "app",
      state: "Queued",
      dismissedAt: null,
      ...overrides,
    }) as OperationListItem;
  const active = [
    operation({}),
    operation({
      command: "RejectAllApplications",
      resourceType: "Unit",
      resourceId: "unit",
      state: "Rejected",
    }),
  ];
  expect(
    applicationActionOperations({ id: "app", unitId: "unit" }, [
      ...active,
      operation({ resourceType: "ManagerNote" }),
      operation({ state: "Accepted" }),
      operation({ state: "Cancelled" }),
      operation({ dismissedAt: "2026-01-01" }),
      operation({ resourceId: "another" }),
    ]),
  ).toEqual(active);
});

it("never sends the manager-only archive flag for applicants", () => {
  const filters = { status: "Returned" as const, propertyId: "property", showArchived: true };
  expect(toApplicationParams(filters, "statusAsc", false)).toEqual({
    status: "Returned",
    propertyId: "property",
    sortBy: "statusChangedAt",
    sortDirection: "asc",
  });
  expect(toApplicationParams(filters, "createdDesc", true)).toMatchObject({
    showArchived: true,
    sortBy: "createdAt",
    sortDirection: "desc",
  });
});
