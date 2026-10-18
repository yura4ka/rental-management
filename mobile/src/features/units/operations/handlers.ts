import type { CommandHandlers } from "@/features/operations/commandCatalog";
import type { UnitsRepository } from "../unitsRepository";
import type { IUnitsApi } from "../types";
import type { UnitCommands } from "./types";
import {
  archiveUnitInputSchema,
  archiveUnitRequestSchema,
  createUnitInputSchema,
  createUnitRequestSchema,
  unitResponseSchema,
  updateUnitInputSchema,
  updateUnitRequestSchema,
} from "./schemas";

export function createUnitHandlers(
  api: IUnitsApi,
  repository: UnitsRepository,
): CommandHandlers<UnitCommands> {
  return {
    CreateUnit: {
      resourceType: "Unit",
      inputSchema: createUnitInputSchema,
      requestSchema: createUnitRequestSchema,
      responseSchema: unitResponseSchema,
      prepare: (input, context) => ({ ...input, ...context.metadata }),
      execute: ({ propertyId, ...body }, signal) => api.createUnit({ propertyId }, body, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
    UpdateUnit: {
      resourceType: "Unit",
      inputSchema: updateUnitInputSchema,
      requestSchema: updateUnitRequestSchema,
      responseSchema: unitResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ propertyId, id, ...body }, signal) =>
        api.updateUnit({ propertyId, id }, body, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
    ArchiveUnit: {
      resourceType: "Unit",
      inputSchema: archiveUnitInputSchema,
      requestSchema: archiveUnitRequestSchema,
      responseSchema: unitResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ propertyId, id, ...body }, signal) =>
        api.archiveUnit({ propertyId, id }, body, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
  };
}
