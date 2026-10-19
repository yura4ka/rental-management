import type { z } from "zod";
import type { ArchiveUnitResponse, CreateUnitResponse, UpdateUnitResponse } from "../types";
import type {
  archiveUnitInputSchema,
  archiveUnitRequestSchema,
  createUnitInputSchema,
  createUnitRequestSchema,
  updateUnitInputSchema,
  updateUnitRequestSchema,
} from "./schemas";

export type UnitCommands = {
  CreateUnit: {
    input: z.infer<typeof createUnitInputSchema>;
    request: z.infer<typeof createUnitRequestSchema>;
    response: CreateUnitResponse;
  };
  UpdateUnit: {
    input: z.infer<typeof updateUnitInputSchema>;
    request: z.infer<typeof updateUnitRequestSchema>;
    response: UpdateUnitResponse;
  };
  ArchiveUnit: {
    input: z.infer<typeof archiveUnitInputSchema>;
    request: z.infer<typeof archiveUnitRequestSchema>;
    response: ArchiveUnitResponse;
  };
};
