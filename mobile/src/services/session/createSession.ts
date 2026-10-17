import type { QueryClient } from "@tanstack/react-query";
import { FetchTransport } from "@/services/api";
import { Database, ExpoDatabaseDriver } from "@/services/database";
import { network } from "@/services/network";
import { KeyStorage, SecureStorage, TokenStorage } from "@/services/secureStorage";
import { Session } from "./session";

export function createSession(baseUrl: string, queryClient: QueryClient): Session {
  const secureStorage = new SecureStorage();
  const tokens = new TokenStorage(secureStorage);
  const keys = new KeyStorage(secureStorage);
  const database = new Database(new ExpoDatabaseDriver());
  const transport = new FetchTransport(baseUrl, tokens, {
    signOut: async () => {
      if (session.status === "authenticated") await session.signOut("session-expired");
    },
  });
  const session: Session = new Session(tokens, keys, database, transport, queryClient, network);
  return session;
}
