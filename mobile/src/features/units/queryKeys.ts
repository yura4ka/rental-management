import type { GetUnitsRequestParams } from "./types";

export const unitKeys = {
  all: ["units"] as const,
  list: (params: Omit<GetUnitsRequestParams, "page">) => [...unitKeys.all, "list", params] as const,
};
