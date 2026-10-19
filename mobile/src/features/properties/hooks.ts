import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { useInventoryMutation } from "@/features/inventory/hooks/useInventoryMutation";
import { propertyKeys } from "./queryKeys";
import type { GetPropertiesRequestParams } from "./types";
import type { PropertyCommands } from "./operations/types";

export function useProperties(params: Omit<GetPropertiesRequestParams, "page"> = {}) {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: propertyKeys.list(params),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      session.getService("properties").getProperties({ ...params, page: pageParam }, signal),
    getNextPageParam: ({ data }) =>
      data.page * data.pageSize < data.totalCount ? data.page + 1 : undefined,
  });
}

export function useProperty(id: string) {
  const session = useSession();
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: ({ signal }) => session.getService("properties").getProperty(id, signal),
  });
}

export function useCreateProperty() {
  const session = useSession();
  return useInventoryMutation((input: PropertyCommands["CreateProperty"]["input"]) =>
    session.getService("properties").createProperty(input),
  );
}

export function useUpdateProperty() {
  const session = useSession();
  return useInventoryMutation((input: PropertyCommands["UpdateProperty"]["input"]) =>
    session.getService("properties").updateProperty(input),
  );
}

export function useArchiveProperty() {
  const session = useSession();
  return useInventoryMutation((input: PropertyCommands["ArchiveProperty"]["input"]) =>
    session.getService("properties").archiveProperty(input),
  );
}
