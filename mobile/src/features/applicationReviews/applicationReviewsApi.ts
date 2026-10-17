import type { HTTPTransport } from "@/services/api";
import type {
  ApproveApplicationRequestBody,
  ApproveApplicationRequestParams,
  ApproveApplicationResponse,
  DenyApplicationRequestBody,
  DenyApplicationRequestParams,
  DenyApplicationResponse,
  IApplicationReviewsApi,
  RejectAllApplicationsRequestBody,
  RejectAllApplicationsRequestParams,
  RejectAllApplicationsResponse,
  ReleaseApplicationRequestBody,
  ReleaseApplicationRequestParams,
  ReleaseApplicationResponse,
  ReturnApplicationRequestBody,
  ReturnApplicationRequestParams,
  ReturnApplicationResponse,
  SaveManagerNoteRequestBody,
  SaveManagerNoteRequestParams,
  SaveManagerNoteResponse,
  StartReviewRequestBody,
  StartReviewRequestParams,
  StartReviewResponse,
} from "./types";

export class ApplicationReviewsApi implements IApplicationReviewsApi {
  constructor(private readonly api: HTTPTransport) {}

  startReview(
    params: StartReviewRequestParams,
    body: StartReviewRequestBody,
    signal?: AbortSignal,
  ): Promise<StartReviewResponse> {
    return this.api.fetch<StartReviewResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/start-review`,
      method: "POST",
      body,
      signal,
    });
  }

  releaseApplication(
    params: ReleaseApplicationRequestParams,
    body: ReleaseApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<ReleaseApplicationResponse> {
    return this.api.fetch<ReleaseApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/release`,
      method: "POST",
      body,
      signal,
    });
  }

  returnApplication(
    params: ReturnApplicationRequestParams,
    body: ReturnApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<ReturnApplicationResponse> {
    return this.api.fetch<ReturnApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/return`,
      method: "POST",
      body,
      signal,
    });
  }

  denyApplication(
    params: DenyApplicationRequestParams,
    body: DenyApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<DenyApplicationResponse> {
    return this.api.fetch<DenyApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/deny`,
      method: "POST",
      body,
      signal,
    });
  }

  approveApplication(
    params: ApproveApplicationRequestParams,
    body: ApproveApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<ApproveApplicationResponse> {
    return this.api.fetch<ApproveApplicationResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/approve`,
      method: "POST",
      body,
      signal,
    });
  }

  saveManagerNote(
    params: SaveManagerNoteRequestParams,
    body: SaveManagerNoteRequestBody,
    signal?: AbortSignal,
  ): Promise<SaveManagerNoteResponse> {
    return this.api.fetch<SaveManagerNoteResponse>({
      url: `/api/applications/${encodeURIComponent(params.id)}/my-note`,
      method: "PUT",
      body,
      signal,
    });
  }

  rejectAllApplications(
    params: RejectAllApplicationsRequestParams,
    body: RejectAllApplicationsRequestBody,
    signal?: AbortSignal,
  ): Promise<RejectAllApplicationsResponse> {
    return this.api.fetch<RejectAllApplicationsResponse>({
      url: `/api/units/${encodeURIComponent(params.unitId)}/applications/reject-all`,
      method: "POST",
      body,
      signal,
    });
  }
}
