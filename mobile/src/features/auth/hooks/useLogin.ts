import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/services/session";
import { authKeys } from "../queryKeys";
import type { LoginInput } from "../schemas";

export function useLogin() {
  const session = useSession();
  return useMutation({
    mutationKey: authKeys.login(),
    mutationFn: (input: LoginInput) => session.login(input),
    gcTime: 0,
    retry: false,
  });
}
