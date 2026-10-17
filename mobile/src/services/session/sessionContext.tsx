import { createContext, type PropsWithChildren } from "react";
import type { Session } from "./session";

export const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: PropsWithChildren<{ session: Session }>) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
