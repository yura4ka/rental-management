import type { GetApplicationsRequestParams } from "./types";

export const applicationKeys = {
  all: ["applications"] as const,
  list: (params: Omit<GetApplicationsRequestParams, "page">) =>
    ["applications", "list", params] as const,
  detail: (id: string) => ["applications", "detail", id] as const,
  editor: (id: string) => ["applications", "editor", id] as const,
  summary: (id: string) => ["applications", "summary", id] as const,
  localDrafts: () => ["applications", "localDrafts"] as const,
  operations: () => ["applicationOperations"] as const,
};
