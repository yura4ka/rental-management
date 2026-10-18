import { useQuery } from "@tanstack/react-query";
import { useSession, useStatus } from "@/services/session";
import { authKeys } from "../queryKeys";

export function useGetAccount() {
  const session = useSession();
  const status = useStatus();
  return useQuery({
    queryKey: authKeys.account(),
    queryFn: ({ signal }) => session.getService("auth").getCurrentAccount(signal),
    enabled: status === "authenticated",
  });
}
