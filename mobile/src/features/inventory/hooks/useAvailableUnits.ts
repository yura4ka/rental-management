import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { inventoryKeys } from "../queryKeys";
import type { GetAvailableUnitsRequestParams } from "../types";

export function useAvailableUnits(params: Omit<GetAvailableUnitsRequestParams, "page"> = {}) {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: inventoryKeys.availableUnits(params),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      session.getService("inventory").getAvailableUnits({ ...params, page: pageParam }, signal),
    getNextPageParam: ({ data }) =>
      data.page * data.pageSize < data.totalCount ? data.page + 1 : undefined,
  });
}
