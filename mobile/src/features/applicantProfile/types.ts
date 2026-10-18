import type { MutationResponse, OperationRequestBody } from "../operations/types";
import type { Address } from "../address/types";

export type ProfileAddressDto = Address;

export type ApplicantInformationDto = {
  name: string | null;
  phone: string | null;
  contactEmail: string | null;
  currentAddress: ProfileAddressDto | null;
};

export type ResidenceInputDto = {
  address: ProfileAddressDto | null;
  landlordName: string | null;
  landlordPhone: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
};

export type ResidenceDto = {
  position: number;
  address: ProfileAddressDto;
  landlordName: string;
  landlordPhone: string;
  moveInDate: string;
  moveOutDate: string;
};

export type GetApplicantProfileResponse = {
  applicantInformation: ApplicantInformationDto;
  residenceHistory: ResidenceDto[];
  version: string;
};

export type UpdateApplicantInformationRequestBody = OperationRequestBody & {
  expectedVersion: string;
  applicantInformation: ApplicantInformationDto | null;
};

export type UpdateResidenceHistoryRequestBody = OperationRequestBody & {
  expectedVersion: string;
  residenceHistory: (ResidenceInputDto | null)[] | null;
};

export type UpdateApplicantInformationResponse = MutationResponse<GetApplicantProfileResponse>;
export type UpdateResidenceHistoryResponse = MutationResponse<GetApplicantProfileResponse>;

export interface IApplicantProfileApi {
  getApplicantProfile(signal?: AbortSignal): Promise<GetApplicantProfileResponse>;
  updateApplicantInformation(
    body: UpdateApplicantInformationRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateApplicantInformationResponse>;
  updateResidenceHistory(
    body: UpdateResidenceHistoryRequestBody,
    signal?: AbortSignal,
  ): Promise<UpdateResidenceHistoryResponse>;
}
