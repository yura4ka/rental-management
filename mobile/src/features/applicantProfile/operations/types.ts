import type { OperationRequestBody } from "@/features/operations/types";
import type {
  UpdateApplicantInformationRequestBody,
  UpdateApplicantInformationResponse,
  UpdateResidenceHistoryRequestBody,
  UpdateResidenceHistoryResponse,
} from "../types";

/** Stable persisted command names and their correlated input, wire request, and accepted response. */
export type ApplicantProfileCommands = {
  UpdateProfileInformation: {
    input: Omit<UpdateApplicantInformationRequestBody, keyof OperationRequestBody>;
    request: UpdateApplicantInformationRequestBody;
    response: UpdateApplicantInformationResponse;
  };
  UpdateProfileResidences: {
    input: Omit<UpdateResidenceHistoryRequestBody, keyof OperationRequestBody>;
    request: UpdateResidenceHistoryRequestBody;
    response: UpdateResidenceHistoryResponse;
  };
};
