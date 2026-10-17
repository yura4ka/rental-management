import { AuthApi } from "@/features/auth/authApi";
import { AuthRepository } from "@/features/auth/authRepository";
import { AuthService } from "@/features/auth/authService";
import type { HTTPTransport } from "@/services/api";
import type { IDatabaseQueries } from "@/services/database/types";
import type { INetwork } from "@/services/network";

type SessionServiceDependencies = {
  api: HTTPTransport;
  db: IDatabaseQueries;
  network: INetwork;
  sessionSignal: AbortSignal;
};

export function createServices({ api, db, network, sessionSignal }: SessionServiceDependencies) {
  return {
    auth: new AuthService(new AuthApi(api), new AuthRepository(db), network, sessionSignal),
  };
}

export type SessionServices = ReturnType<typeof createServices>;
