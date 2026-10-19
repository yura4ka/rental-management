import type { CommandHandlers } from "@/features/operations/commandCatalog";
import type { PropertiesRepository } from "../propertiesRepository";
import type { IPropertiesApi } from "../types";
import type { PropertyCommands } from "./types";
import {
  archivePropertyInputSchema,
  archivePropertyRequestSchema,
  createPropertyInputSchema,
  createPropertyRequestSchema,
  propertyResponseSchema,
  updatePropertyInputSchema,
  updatePropertyRequestSchema,
} from "./schemas";

export function createPropertyHandlers(
  api: IPropertiesApi,
  repository: PropertiesRepository,
): CommandHandlers<PropertyCommands> {
  return {
    CreateProperty: {
      resourceType: "Property",
      inputSchema: createPropertyInputSchema,
      requestSchema: createPropertyRequestSchema,
      responseSchema: propertyResponseSchema,
      prepare: (input, context) => ({ ...input, ...context.metadata }),
      execute: (request, signal) => api.createProperty(request, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
    UpdateProperty: {
      resourceType: "Property",
      inputSchema: updatePropertyInputSchema,
      requestSchema: updatePropertyRequestSchema,
      responseSchema: propertyResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ id, ...body }, signal) => api.updateProperty({ id }, body, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
    ArchiveProperty: {
      resourceType: "Property",
      inputSchema: archivePropertyInputSchema,
      requestSchema: archivePropertyRequestSchema,
      responseSchema: propertyResponseSchema,
      prepare: (input, context) => ({
        ...input,
        ...context.metadata,
        expectedVersion: context.predecessorVersion ?? input.expectedVersion,
      }),
      execute: ({ id, ...body }, signal) => api.archiveProperty({ id }, body, signal),
      persist: (response, tx) => repository.save(response, tx),
    },
  };
}
