import type { HTTPTransport } from "@/services/api";
import type {
  CreateApplicationRequestBody,
  CreateApplicationResponse,
  GetApplicationRequestParams,
  GetApplicationResponse,
  GetApplicationsRequestParams,
  GetApplicationsResponse,
  IApplicationsApi,
  SubmitApplicationRequestBody,
  SubmitApplicationRequestParams,
  SubmitApplicationResponse,
  UpdateApplicationInformationRequestBody,
  UpdateApplicationInformationRequestParams,
  UpdateApplicationInformationResponse,
  UpdateApplicationResidencesRequestBody,
  UpdateApplicationResidencesRequestParams,
  UpdateApplicationResidencesResponse,
  WithdrawApplicationRequestBody,
  WithdrawApplicationRequestParams,
  WithdrawApplicationResponse,
} from "./types";

export class ApplicationsApi implements IApplicationsApi {
  constructor(private readonly api: HTTPTransport) {}

  getApplications(
    params: GetApplicationsRequestParams = {},
    signal?: AbortSignal,
  ): Promise<GetApplicationsResponse> {
    return this.api.fetch<GetApplicationsResponse>({ url: "/api/applications", params, signal });
  }

  getApplication(
    params: GetApplicationRequestParams,
    signal?: AbortSignal,
  ): Promise<GetApplicationResponse> {
    return this.api.fetch<GetApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}`,
      signal,
    });
  }

  createApplication(
    body: CreateApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<CreateApplicationResponse> {
    return this.api.fetch<CreateApplicationResponse>({
      url: "/api/applications",
      method: "POST",
      body,
      signal,
    });
  }

  updateApplicationInformation(
    params: UpdateApplicationInformationRequestParams,
    body: UpdateApplicationInformationRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateApplicationInformationResponse> {
    return this.api.fetch<UpdateApplicationInformationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/applicant-information`,
      method: "PUT",
      body,
      signal,
    });
  }

  updateApplicationResidences(
    params: UpdateApplicationResidencesRequestParams,
    body: UpdateApplicationResidencesRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateApplicationResidencesResponse> {
    return this.api.fetch<UpdateApplicationResidencesResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/residence-history`,
      method: "PUT",
      body,
      signal,
    });
  }

  submitApplication(
    params: SubmitApplicationRequestParams,
    body: SubmitApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<SubmitApplicationResponse> {
    return this.api.fetch<SubmitApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/submit`,
      method: "POST",
      body,
      signal,
    });
  }

  withdrawApplication(
    params: WithdrawApplicationRequestParams,
    body: WithdrawApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<WithdrawApplicationResponse> {
    return this.api.fetch<WithdrawApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/withdraw`,
      method: "POST",
      body,
      signal,
    });
  }
}
