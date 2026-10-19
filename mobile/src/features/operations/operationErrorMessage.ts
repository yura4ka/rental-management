import { HTTPError } from "@/services/api";
import { getApiErrorMessage } from "@/shared/utils/errorUtils";
import { PendingResourceOperationsError } from "./operationsRepository";

/** Business conflicts must not be presented as a successful save or an invitation to rebase. */
export function getOperationErrorMessage(error: unknown): string {
  if (error instanceof PendingResourceOperationsError) return error.message;
  const validation = getApiErrorMessage(error);
  if (validation !== "Unknown error") return validation;
  if (error instanceof HTTPError) {
    if (error.status === 409)
      return "This action conflicts with the current server state. Refresh the record and reopen the form before reapplying your changes.";
    if (error.status === 401 || error.status === 403)
      return "You are not authorized to perform this action.";
    if (error.status === 404) return "This record is no longer available.";
  }
  return "Could not complete this action. Your input has been preserved.";
}
