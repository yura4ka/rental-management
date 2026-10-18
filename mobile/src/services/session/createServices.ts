import { AuthApi } from "@/features/auth/authApi";
import { InventoryApi } from "@/features/inventory/inventoryApi";
import { InventoryRepository } from "@/features/inventory/inventoryRepository";
import { InventoryService } from "@/features/inventory/inventoryService";
import { AuthRepository } from "@/features/auth/authRepository";
import { AuthService } from "@/features/auth/authService";
import { ApplicantProfileApi } from "@/features/applicantProfile/applicantProfileApi";
import { ApplicantProfileRepository } from "@/features/applicantProfile/applicantProfileRepository";
import { ApplicantProfileService } from "@/features/applicantProfile/applicantProfileService";
import { createApplicantProfileHandlers } from "@/features/applicantProfile/operations/handlers";
import { CommandCatalog, type CommandHandlers } from "@/features/operations/commandCatalog";
import type { Commands } from "@/features/operations/commands";
import { OperationsApi } from "@/features/operations/operationsApi";
import { OperationsRepository } from "@/features/operations/operationsRepository";
import { OperationsService } from "@/features/operations/operationsService";
import type { HTTPTransport } from "@/services/api";
import type { ITransactionalDatabase } from "@/services/database/types";
import type { INetwork } from "@/services/network";
import { PropertiesApi } from "@/features/properties/propertiesApi";
import { PropertiesRepository } from "@/features/properties/propertiesRepository";
import { PropertiesService } from "@/features/properties/propertiesService";
import { createPropertyHandlers } from "@/features/properties/operations/handlers";
import { UnitsApi } from "@/features/units/unitsApi";
import { UnitsRepository } from "@/features/units/unitsRepository";
import { UnitsService } from "@/features/units/unitsService";
import { createUnitHandlers } from "@/features/units/operations/handlers";

type SessionServiceDependencies = {
  api: HTTPTransport;
  db: ITransactionalDatabase;
  network: INetwork;
  sessionSignal: AbortSignal;
};

export function createServices({ api, db, network, sessionSignal }: SessionServiceDependencies) {
  const auth = new AuthService(new AuthApi(api), new AuthRepository(db), network, sessionSignal);
  const profileApi = new ApplicantProfileApi(api);
  const profileRepository = new ApplicantProfileRepository(db);
  const propertiesApi = new PropertiesApi(api);
  const propertiesRepository = new PropertiesRepository(db);
  const unitsApi = new UnitsApi(api);
  const unitsRepository = new UnitsRepository(db);
  const handlers = {
    ...createApplicantProfileHandlers(profileApi, profileRepository),
    ...createPropertyHandlers(propertiesApi, propertiesRepository),
    ...createUnitHandlers(unitsApi, unitsRepository),
  } satisfies CommandHandlers<Commands>;
  const operations = new OperationsService(
    new OperationsRepository(db),
    new OperationsApi(api),
    network,
    sessionSignal,
    () => auth.getCurrentAccount(sessionSignal),
    new CommandCatalog<Commands>(handlers),
  );
  const applicantProfile = new ApplicantProfileService(
    profileApi,
    profileRepository,
    operations,
    network,
    sessionSignal,
  );
  return {
    properties: new PropertiesService(
      propertiesApi,
      propertiesRepository,
      operations,
      network,
      sessionSignal,
    ),
    units: new UnitsService(unitsApi, unitsRepository, operations, network, sessionSignal),
    inventory: new InventoryService(
      new InventoryApi(api),
      new InventoryRepository(db),
      network,
      sessionSignal,
    ),
    auth,
    operations,
    applicantProfile,
  };
}

export type SessionServices = ReturnType<typeof createServices>;
