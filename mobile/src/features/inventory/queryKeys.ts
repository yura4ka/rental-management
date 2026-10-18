import type { GetAvailableUnitsRequestParams } from "./types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  availableUnits: (params: GetAvailableUnitsRequestParams) =>
    [...inventoryKeys.all, "availableUnits", params] as const,
  unitTypes: () => [...inventoryKeys.all, "unitTypes"] as const,
};
