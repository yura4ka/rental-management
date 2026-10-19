import { z } from "zod";
import type { OperationListItem } from "@/features/operations/types";
import type { ApplicationDto, ApplicationStatus, GetApplicationsRequestParams } from "./types";

export const applicationStatuses = [
  "Draft",
  "Submitted",
  "InReview",
  "Returned",
  "Approved",
  "Denied",
  "Withdrawn",
] as const;

export function statusLabel(status: ApplicationStatus) {
  return status === "InReview" ? "In review" : status;
}

export const reviewActions = {
  startReview: { title: "Start review", comment: "none" },
  release: { title: "Release", comment: "none" },
  return: { title: "Return", comment: "required" },
  deny: { title: "Reject", comment: "required" },
  approve: { title: "Approve", comment: "optional" },
} as const;

export type ReviewAction = keyof typeof reviewActions;

export function availableApplicationActions(
  status: ApplicationStatus,
  isApplicant: boolean,
  isOwner: boolean,
  locked: boolean,
): { edit: boolean; withdraw: boolean; review: ReviewAction[] } {
  if (locked) return { edit: false, withdraw: false, review: [] };
  const open = ["Draft", "Submitted", "InReview", "Returned"].includes(status);
  return {
    edit: isApplicant && (status === "Draft" || status === "Returned"),
    withdraw: isApplicant && open,
    review: !isOwner
      ? []
      : status === "Submitted"
        ? ["startReview"]
        : status === "InReview"
          ? ["release", "return", "deny", "approve"]
          : [],
  };
}

export function applicationActionOperations(
  application: Pick<ApplicationDto, "id" | "unitId">,
  operations: OperationListItem[],
) {
  return operations.filter(
    (operation) =>
      !operation.dismissedAt &&
      ["Queued", "Dispatched", "Rejected"].includes(operation.state) &&
      ((operation.resourceType === "Application" && operation.resourceId === application.id) ||
        (operation.command === "RejectAllApplications" &&
          operation.resourceId === application.unitId)),
  );
}

export const reviewCommentFormSchema = (required: boolean) =>
  z.object({
    comment: z
      .string()
      .max(2000)
      .refine((value) => !required || value.trim().length > 0, "A comment is required."),
  });

export const managerNoteFormSchema = z.object({ body: z.string().max(2000) });

export type ApplicationFilters = {
  status: ApplicationStatus | "";
  propertyId: string;
  showArchived: boolean;
};

export const defaultApplicationFilters: ApplicationFilters = {
  status: "",
  propertyId: "",
  showArchived: false,
};

export const applicationSortOptions = [
  { label: "Newest created", value: "createdDesc" },
  { label: "Oldest created", value: "createdAsc" },
  { label: "Recently changed status", value: "statusDesc" },
  { label: "Oldest status change", value: "statusAsc" },
] as const;

export type ApplicationSort = (typeof applicationSortOptions)[number]["value"];

export function toApplicationParams(
  filters: ApplicationFilters,
  sort: ApplicationSort,
  manager: boolean,
): Omit<GetApplicationsRequestParams, "page"> {
  return {
    status: filters.status || undefined,
    propertyId: filters.propertyId || undefined,
    ...(manager ? { showArchived: filters.showArchived } : {}),
    sortBy: sort.startsWith("created") ? "createdAt" : "statusChangedAt",
    sortDirection: sort.endsWith("Asc") ? "asc" : "desc",
  };
}

export function applicationDate(value: string | null | undefined, calendar = false) {
  if (!value) return "Not provided";
  return new Date(value).toLocaleDateString(undefined, calendar ? { timeZone: "UTC" } : undefined);
}
