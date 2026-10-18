import type { INetwork } from "@/services/network";
import type { OperationsService } from "@/features/operations/operationsService";
import { readInventory } from "@/features/inventory/inventoryRead";
import { saveInventoryIntent } from "@/features/inventory/saveInventoryIntent";
import type { PropertiesRepository } from "./propertiesRepository";
import type { GetPropertiesRequestParams, IPropertiesApi } from "./types";
import type { PropertyCommands } from "./operations/types";
import {
  archivePropertyInputSchema,
  createPropertyInputSchema,
  updatePropertyInputSchema,
} from "./operations/schemas";

export class PropertiesService {
  constructor(
    private readonly api: IPropertiesApi,
    private readonly repository: PropertiesRepository,
    private readonly operations: OperationsService,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
  ) {}

  getProperties(params: GetPropertiesRequestParams = {}, signal?: AbortSignal) {
    return readInventory(
      this.network,
      this.sessionSignal,
      signal,
      (requestSignal) => this.api.getProperties(params, requestSignal),
      () => this.repository.getProperties(params),
      (response) => this.repository.savePage(response),
    );
  }

  async getProperty(id: string, signal?: AbortSignal) {
    // There is no property-by-ID endpoint. Resolve through the authorized owned list.
    return readInventory(
      this.network,
      this.sessionSignal,
      signal,
      async (requestSignal) => {
        let page = 1;
        while (true) {
          const response = await this.api.getProperties(
            { includeArchived: true, page, pageSize: 100 },
            requestSignal,
          );
          const property = response.items.find((item) => item.id === id);
          if (property) return property;
          if (page * response.pageSize >= response.totalCount)
            throw new Error("Property not found.");
          page++;
        }
      },
      async () => {
        const property = await this.repository.get(id);
        if (!property) throw new Error("Property unavailable offline.");
        return property;
      },
      (property) => this.repository.save(property),
    );
  }

  createProperty(input: PropertyCommands["CreateProperty"]["input"]) {
    const intent = createPropertyInputSchema.parse(input);
    return this.operations.perform(
      { command: "CreateProperty", resourceType: "Property", resourceId: intent.id, intent },
      saveInventoryIntent,
    );
  }

  updateProperty(input: PropertyCommands["UpdateProperty"]["input"]) {
    const intent = updatePropertyInputSchema.parse(input);
    return this.operations.perform(
      { command: "UpdateProperty", resourceType: "Property", resourceId: intent.id, intent },
      saveInventoryIntent,
    );
  }

  archiveProperty(input: PropertyCommands["ArchiveProperty"]["input"]) {
    const intent = archivePropertyInputSchema.parse(input);
    return this.operations.perform(
      { command: "ArchiveProperty", resourceType: "Property", resourceId: intent.id, intent },
      saveInventoryIntent,
    );
  }
}
