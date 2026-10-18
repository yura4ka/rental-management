import type { Address, AddressInput } from "./types";

export function getAddressDisplayName(address: Address | null | undefined): string {
  return [address?.displayName, address?.streetAddress, address?.line2].filter(Boolean).join(", ");
}

export function toAddressInput(address?: Address | null): AddressInput {
  return {
    displayName: address?.displayName ?? "",
    streetAddress: address?.streetAddress ?? "",
    line2: address?.line2 ?? "",
  };
}

export function toAddress(input: AddressInput): Address | null {
  const address = {
    displayName: input.displayName.trim() || null,
    streetAddress: input.streetAddress.trim() || null,
    line2: input.line2.trim() || null,
  };
  return Object.values(address).some(Boolean) ? address : null;
}
