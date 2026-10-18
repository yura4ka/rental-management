import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { authKeys } from "../queryKeys";
import type { RegisterInput } from "../schemas";

export function useRegister() {
  const session = useSession();
  return useMutation({
    mutationKey: authKeys.register(),
    mutationFn: (input: RegisterInput) => session.auth.register(input),
    gcTime: 0,
    retry: false,
  });
}
