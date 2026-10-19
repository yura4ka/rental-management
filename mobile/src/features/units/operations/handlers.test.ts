import type { UnitsRepository } from "../unitsRepository";
import type { IUnitsApi } from "../types";
import { createUnitHandlers } from "./handlers";
import { updateUnitRequestSchema } from "./schemas";

it("freezes route IDs, preserves exact edited versions, and strips route data from the HTTP body", async () => {
  const api = { updateUnit: jest.fn() };
  const handlers = createUnitHandlers(api as unknown as IUnitsApi, {} as UnitsRepository);
  const input = {
    id: "unit",
    propertyId: "property",
    number: "A1",
    unitTypeId: "type",
    bedrooms: 0,
    monthlyRentCents: 100,
    expectedVersion: "9007199254740993",
  };
  const context = {
    metadata: { operationId: "operation", environmentGeneration: "generation" },
    predecessorVersion: undefined,
  };
  const request = handlers.UpdateUnit.prepare(input, context);
  expect(request.expectedVersion).toBe(input.expectedVersion);
  const signal = new AbortController().signal;
  await handlers.UpdateUnit.execute(request, signal);
  const { id, propertyId, ...body } = request;
  expect(api.updateUnit).toHaveBeenCalledWith({ id, propertyId }, body, signal);
  expect(
    handlers.UpdateUnit.prepare(input, { ...context, predecessorVersion: "9007199254740995" })
      .expectedVersion,
  ).toBe("9007199254740995");
  expect(updateUnitRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
});
