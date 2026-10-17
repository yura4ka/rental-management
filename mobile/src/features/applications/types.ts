import type {
  ApplicantInformationDto,
  ProfileAddressDto,
  ResidenceDto,
  UpdateApplicantInformationRequestBody,
  UpdateResidenceHistoryRequestBody,
} from "../applicantProfile/types";
import type { MutationResponse, OperationRequestBody } from "../operations/types";

export type ApplicationStatus =
  "Draft" | "Submitted" | "InReview" | "Returned" | "Approved" | "Denied" | "Withdrawn";

export type ApplicationAction =
  "Create" | "Submit" | "StartReview" | "Release" | "Return" | "Deny" | "Approve" | "Withdraw";

export type ApplicationDto = {
  id: string;
  applicantId: string;
  unitId: string;
  propertyId: string;
  unitNumber: string;
  propertyAddress: ProfileAddressDto;
  isArchived: boolean;
  applicantName: string;
  status: ApplicationStatus;
  createdAt: string;
  statusChangedAt: string;
  version: string;
};

export type ApplicationHistoryDto = {
  id: string;
  sequence: number;
  actorUserId: string;
  action: ApplicationAction;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  comment: string | null;
  occurredAt: string;
};

export type ApplicationLeaseDto = {
  id: string;
  startDate: string;
  endDateExclusive: string;
  approvedAt: string;
};

export type ManagerNoteDto = {
  body: string;
  createdAt: string;
  updatedAt: string;
  version: string;
};

export type GetApplicationsRequestParams = {
  page?: number;
  status?: string | null;
  propertyId?: string | null;
  showArchived?: boolean;
  sortBy?: string;
  sortDirection?: string;
};

export type GetApplicationsResponse = {
  rows: ApplicationDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type GetApplicationRequestParams = { id: string };

export type GetApplicationResponse = {
  application: ApplicationDto;
  applicantInformation: ApplicantInformationDto;
  residenceHistory: ResidenceDto[];
  applicantInformationSavedAt: string;
  residenceHistorySavedAt: string | null;
  history: ApplicationHistoryDto[];
  lease: ApplicationLeaseDto | null;
  myNote: ManagerNoteDto | null;
};

export type CreateApplicationRequestBody = OperationRequestBody & {
  id: string;
  unitId: string;
  applicantInformation: ApplicantInformationDto | null;
};

export type CreateApplicationResponse = MutationResponse<GetApplicationResponse>;

export type UpdateApplicationInformationRequestParams = { id: string };
export type UpdateApplicationInformationRequestBody = UpdateApplicantInformationRequestBody;
export type UpdateApplicationInformationResponse = MutationResponse<GetApplicationResponse>;

export type UpdateApplicationResidencesRequestParams = { id: string };
export type UpdateApplicationResidencesRequestBody = UpdateResidenceHistoryRequestBody;
export type UpdateApplicationResidencesResponse = MutationResponse<GetApplicationResponse>;

export type ApplicationActionRequestBody = OperationRequestBody & {
  expectedVersion: string;
  comment?: string | null;
};

export type SubmitApplicationRequestParams = { id: string };
export type SubmitApplicationRequestBody = ApplicationActionRequestBody;
export type SubmitApplicationResponse = MutationResponse<GetApplicationResponse>;

export type WithdrawApplicationRequestParams = { id: string };
export type WithdrawApplicationRequestBody = ApplicationActionRequestBody;
export type WithdrawApplicationResponse = MutationResponse<GetApplicationResponse>;

export interface IApplicationsApi {
  getApplications(
    params?: GetApplicationsRequestParams,
    signal?: AbortSignal,
  ): Promise<GetApplicationsResponse>;
  getApplication(
    params: GetApplicationRequestParams,
    signal?: AbortSignal,
  ): Promise<GetApplicationResponse>;
  createApplication(
    body: CreateApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<CreateApplicationResponse>;
  updateApplicationInformation(
    params: UpdateApplicationInformationRequestParams,
    body: UpdateApplicationInformationRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateApplicationInformationResponse>;
  updateApplicationResidences(
    params: UpdateApplicationResidencesRequestParams,
    body: UpdateApplicationResidencesRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateApplicationResidencesResponse>;
  submitApplication(
    params: SubmitApplicationRequestParams,
    body: SubmitApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<SubmitApplicationResponse>;
  withdrawApplication(
    params: WithdrawApplicationRequestParams,
    body: WithdrawApplicationRequestBody,
    signal?: AbortSignal,
  ): Promise<WithdrawApplicationResponse>;
}
