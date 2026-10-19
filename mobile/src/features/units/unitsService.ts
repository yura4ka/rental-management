import type { INetwork } from "@/services/network";
import type { OperationsService } from "@/features/operations/operationsService";
import { readInventory } from "@/features/inventory/inventoryRead";
import { saveInventoryIntent } from "@/features/inventory/saveInventoryIntent";
import type { UnitsRepository } from "./unitsRepository";
import type { GetUnitsRequestParams, IUnitsApi } from "./types";
import type { UnitCommands } from "./operations/types";
import {
  archiveUnitInputSchema,
  createUnitInputSchema,
  updateUnitInputSchema,
} from "./operations/schemas";

export class UnitsService {
  constructor(
    private readonly api: IUnitsApi,
    private readonly repository: UnitsRepository,
    private readonly operations: OperationsService,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
  ) {}

  getUnits(params: GetUnitsRequestParams, signal?: AbortSignal) {
    return readInventory(
      this.network,
      this.sessionSignal,
      signal,
      (requestSignal) => this.api.getUnits(params, requestSignal),
      () => this.repository.getUnits(params),
      (response) => this.repository.savePage(response),
    );
  }

  createUnit(input: UnitCommands["CreateUnit"]["input"]) {
    const intent = createUnitInputSchema.parse(input);
    return this.operations.perform(
      {
        command: "CreateUnit",
        resourceType: "Unit",
        resourceId: intent.id,
        intent,
        resources: [{ resourceType: "Property", resourceId: input.propertyId, accessMode: "Read" }],
      },
      saveInventoryIntent,
    );
  }

  updateUnit(input: UnitCommands["UpdateUnit"]["input"]) {
    const intent = updateUnitInputSchema.parse(input);
    return this.operations.perform(
      {
        command: "UpdateUnit",
        resourceType: "Unit",
        resourceId: intent.id,
        intent,
        resources: [{ resourceType: "Property", resourceId: input.propertyId, accessMode: "Read" }],
      },
      saveInventoryIntent,
    );
  }

  archiveUnit(input: UnitCommands["ArchiveUnit"]["input"]) {
    const intent = archiveUnitInputSchema.parse(input);
    return this.operations.perform(
      {
        command: "ArchiveUnit",
        resourceType: "Unit",
        resourceId: intent.id,
        intent,
        resources: [{ resourceType: "Property", resourceId: input.propertyId, accessMode: "Read" }],
      },
      saveInventoryIntent,
    );
  }
}
