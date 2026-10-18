import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { applicantProfileKeys } from "../queryKeys";

export function useApplicantProfile() {
  const session = useSession();
  return useQuery({
    queryKey: applicantProfileKeys.detail(),
    queryFn: () => session.getService("applicantProfile").get(),
  });
}
