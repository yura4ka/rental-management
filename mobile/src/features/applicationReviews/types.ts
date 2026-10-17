import type {
  ApplicationActionRequestBody,
  GetApplicationResponse,
  ManagerNoteDto,
} from "../applications/types";
import type { MutationResponse, OperationRequestBody } from "../operations/types";

export type StartReviewRequestParams = { id: string };
export type StartReviewRequestBody = ApplicationActionRequestBody;
export type StartReviewResponse = MutationResponse<GetApplicationResponse>;

export type ReleaseApplicationRequestParams = { id: string };
export type ReleaseApplicationRequestBody = ApplicationActionRequestBody;
export type ReleaseApplicationResponse = MutationResponse<GetApplicationResponse>;

export type ReturnApplicationRequestParams = { id: string };
export type ReturnApplicationRequestBody = ApplicationActionRequestBody;
export type ReturnApplicationResponse = MutationResponse<GetApplicationResponse>;

export type DenyApplicationRequestParams = { id: string };
export type DenyApplicationRequestBody = ApplicationActionRequestBody;
export type DenyApplicationResponse = MutationResponse<GetApplicationResponse>;

export type ApproveApplicationRequestParams = { id: string };
export type ApproveApplicationRequestBody = ApplicationActionRequestBody;
export type ApproveApplicationResponse = MutationResponse<GetApplicationResponse>;

export type SaveManagerNoteRequestParams = { id: string };
export type SaveManagerNoteRequestBody = OperationRequestBody & {
  expectedVersion: string | null;
  body: string | null;
};
export type SaveManagerNoteResponse = MutationResponse<ManagerNoteDto>;

export type RejectAllApplicationsRequestParams = { unitId: string };
export type RejectAllApplicationsRequestBody = OperationRequestBody & {
  comment: string | null;
};
export type RejectAllApplicationsResponse = MutationResponse<{ affectedCount: number }>;

export interface IApplicationReviewsApi {
  startReview(
    params: StartReviewRequestParams,
    body: StartReviewRequestBody,
    signal?: AbortSignal,
  ): Promise<StartReviewResponse>;
  releaseApplication(
    params: ReleaseApplicationRequestParams,
    body: ReleaseApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<ReleaseApplicationResponse>;
  returnApplication(
    params: ReturnApplicationRequestParams,
    body: ReturnApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<ReturnApplicationResponse>;
  denyApplication(
    params: DenyApplicationRequestParams,
    body: DenyApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<DenyApplicationResponse>;
  approveApplication(
    params: ApproveApplicationRequestParams,
    body: ApproveApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<ApproveApplicationResponse>;
  saveManagerNote(
    params: SaveManagerNoteRequestParams,
    body: SaveManagerNoteRequestBody,
    signal?: AbortSignal,
  ): Promise<SaveManagerNoteResponse>;
  rejectAllApplications(
    params: RejectAllApplicationsRequestParams,
    body: RejectAllApplicationsRequestBody,
    signal?: AbortSignal,
  ): Promise<RejectAllApplicationsResponse>;
}
