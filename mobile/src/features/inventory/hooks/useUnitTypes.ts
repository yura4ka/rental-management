import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { inventoryKeys } from "../queryKeys";

export function useUnitTypes() {
  const session = useSession();
  return useQuery({
    queryKey: inventoryKeys.unitTypes(),
    queryFn: ({ signal }) => session.getService("inventory").getUnitTypes(signal),
  });
}
