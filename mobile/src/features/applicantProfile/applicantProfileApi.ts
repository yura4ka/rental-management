import type { HTTPTransport } from "@/services/api";
import type {
  GetApplicantProfileResponse,
  IApplicantProfileApi,
  UpdateApplicantInformationRequestBody,
  UpdateApplicantInformationResponse,
  UpdateResidenceHistoryRequestBody,
  UpdateResidenceHistoryResponse,
} from "./types";

export class ApplicantProfileApi implements IApplicantProfileApi {
  constructor(private readonly api: HTTPTransport) {}

  getApplicantProfile(signal?: AbortSignal): Promise<GetApplicantProfileResponse> {
    return this.api.fetch<GetApplicantProfileResponse>({ url: "/api/me/profile", signal });
  }

  updateApplicantInformation(
    body: UpdateApplicantInformationRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateApplicantInformationResponse> {
    return this.api.fetch<UpdateApplicantInformationResponse>({
      url: "/api/me/profile/applicant-information",
      method: "PUT",
      body,
      signal,
    });
  }

  updateResidenceHistory(
    body: UpdateResidenceHistoryRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateResidenceHistoryResponse> {
    return this.api.fetch<UpdateResidenceHistoryResponse>({
      url: "/api/me/profile/residence-history",
      method: "PUT",
      body,
      signal,
    });
  }
}
