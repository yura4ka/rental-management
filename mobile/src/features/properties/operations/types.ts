import type { z } from "zod";
import type {
  ArchivePropertyResponse,
  CreatePropertyResponse,
  UpdatePropertyResponse,
} from "../types";
import type {
  archivePropertyInputSchema,
  archivePropertyRequestSchema,
  createPropertyInputSchema,
  createPropertyRequestSchema,
  updatePropertyInputSchema,
  updatePropertyRequestSchema,
} from "./schemas";

export type PropertyCommands = {
  CreateProperty: {
    input: z.infer<typeof createPropertyInputSchema>;
    request: z.infer<typeof createPropertyRequestSchema>;
    response: CreatePropertyResponse;
  };
  UpdateProperty: {
    input: z.infer<typeof updatePropertyInputSchema>;
    request: z.infer<typeof updatePropertyRequestSchema>;
    response: UpdatePropertyResponse;
  };
  ArchiveProperty: {
    input: z.infer<typeof archivePropertyInputSchema>;
    request: z.infer<typeof archivePropertyRequestSchema>;
    response: ArchivePropertyResponse;
  };
};
