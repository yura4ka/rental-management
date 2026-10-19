import type { z } from "zod";
import type { MutationResponse, OperationRequestBody } from "@/features/operations/types";
import type {
  createApplicationInputSchema,
  applicationInformationInputSchema,
  applicationResidencesInputSchema,
  applicationActionInputSchema,
} from "../applicationValidation";
import type { CreateApplicationResponse, GetApplicationResponse } from "../types";

type Command<
  S extends z.ZodType<Record<string, unknown>>,
  R = MutationResponse<GetApplicationResponse>,
> = {
  input: z.infer<S>;
  request: z.infer<S> & OperationRequestBody;
  response: R;
};

export type ApplicationCommands = {
  CreateApplication: Command<typeof createApplicationInputSchema, CreateApplicationResponse>;
  UpdateApplicationInformation: Command<typeof applicationInformationInputSchema>;
  UpdateApplicationResidences: Command<typeof applicationResidencesInputSchema>;
  SubmitApplication: Command<typeof applicationActionInputSchema>;
  WithdrawApplication: Command<typeof applicationActionInputSchema>;
};
