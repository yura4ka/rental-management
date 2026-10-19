import { useContext } from "react";
import type { Session } from "../session";
import { SessionContext } from "../sessionContext";

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used within SessionProvider.");
  return session;
}
