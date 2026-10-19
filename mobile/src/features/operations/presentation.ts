import { z } from "zod";
import { Routes } from "@/app/navigation/routes";
import type { OperationListItem } from "./types";

export function operationLabel(command: string) {
  return command.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function operationStatus(operation: OperationListItem) {
  switch (operation.state) {
    case "Accepted":
      return "Success";
    case "Rejected":
      return "Failed";
    case "Cancelled":
      return "Cancelled";
    case "Dispatched":
      return "Dispatched — awaiting confirmation";
    case "Queued":
      return "Queued";
  }
}

export function canClearOperation(operation: OperationListItem) {
  return (
    operation.state === "Rejected" || (operation.state === "Queued" && !operation.firstDispatchedAt)
  );
}

export function operationTarget(operation: OperationListItem) {
  if (operation.resourceType === "Profile") return { screen: Routes.Profile } as const;
  if (operation.resourceType === "Application" || operation.resourceType === "ManagerNote") {
    return {
      screen:
        operation.command === "CreateApplication"
          ? Routes.ApplicationForm
          : Routes.ApplicationDetails,
      applicationId: operation.resourceId,
    } as const;
  }
  if (operation.resourceType === "Property") {
    return { screen: Routes.PropertyDetails, propertyId: operation.resourceId } as const;
  }
  if (operation.resourceType === "Unit") {
    // Unit editors live on PropertyDetails. Older/malformed intents may not identify a parent.
    try {
      const input = z.object({ propertyId: z.uuid() }).safeParse(JSON.parse(operation.intentJson));
      if (input.success)
        return { screen: Routes.PropertyDetails, propertyId: input.data.propertyId } as const;
    } catch {
      // Keep malformed retained work visible without inventing a navigation target.
    }
  }
  return null;
}
