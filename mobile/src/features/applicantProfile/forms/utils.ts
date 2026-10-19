import { toAddress, toAddressInput } from "@/features/address/utils";
import type { ApplicantInformationDto, ResidenceDto } from "../types";
import type { ProfileFormInput, ResidenceFormInput } from "./schemas";

export function toProfileFormInput(value: ApplicantInformationDto): ProfileFormInput {
  return {
    name: value.name ?? "",
    phone: value.phone ?? "",
    contactEmail: value.contactEmail ?? "",
    currentAddress: toAddressInput(value.currentAddress),
  };
}

export function toApplicantInformation(value: ProfileFormInput): ApplicantInformationDto {
  return {
    name: value.name.trim() || null,
    phone: value.phone.trim() || null,
    contactEmail: value.contactEmail.trim() || null,
    currentAddress: toAddress(value.currentAddress),
  };
}

export function toResidenceFormInput(value?: ResidenceDto): ResidenceFormInput {
  return {
    address: toAddressInput(value?.address),
    landlordName: value?.landlordName ?? "",
    landlordPhone: value?.landlordPhone ?? "",
    moveInDate: value?.moveInDate ?? "",
    moveOutDate: value?.moveOutDate ?? "",
  };
}

export function compareResidences(a: ResidenceDto, b: ResidenceDto): number {
  return (
    a.moveInDate.localeCompare(b.moveInDate) ||
    a.moveOutDate.localeCompare(b.moveOutDate) ||
    a.position - b.position
  );
}
