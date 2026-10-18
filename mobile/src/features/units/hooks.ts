import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { useInventoryMutation } from "@/features/inventory/hooks/useInventoryMutation";
import { unitKeys } from "./queryKeys";
import type { GetUnitsRequestParams } from "./types";
import type { UnitCommands } from "./operations/types";

export function useUnits(params: Omit<GetUnitsRequestParams, "page">, enabled = true) {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: unitKeys.list(params),
    initialPageParam: 1,
    enabled,
    queryFn: ({ pageParam, signal }) =>
      session.getService("units").getUnits({ ...params, page: pageParam }, signal),
    getNextPageParam: ({ data }) =>
      data.page * data.pageSize < data.totalCount ? data.page + 1 : undefined,
  });
}

export function useCreateUnit() {
  const session = useSession();
  return useInventoryMutation((input: UnitCommands["CreateUnit"]["input"]) =>
    session.getService("units").createUnit(input),
  );
}

export function useUpdateUnit() {
  const session = useSession();
  return useInventoryMutation((input: UnitCommands["UpdateUnit"]["input"]) =>
    session.getService("units").updateUnit(input),
  );
}

export function useArchiveUnit() {
  const session = useSession();
  return useInventoryMutation((input: UnitCommands["ArchiveUnit"]["input"]) =>
    session.getService("units").archiveUnit(input),
  );
}
