import type { z } from "zod";
import type { OperationRequestBody, MutationResponse } from "@/features/operations/types";
import type { GetApplicationResponse, ManagerNoteDto } from "@/features/applications/types";
import type {
  reviewActionInputSchema,
  reviewOutcomeInputSchema,
  approveApplicationInputSchema,
  saveManagerNoteInputSchema,
  rejectAllApplicationsInputSchema,
} from "./schemas";

type Command<
  S extends z.ZodType<Record<string, unknown>>,
  R = MutationResponse<GetApplicationResponse>,
> = {
  input: z.infer<S>;
  request: z.infer<S> & OperationRequestBody;
  response: R;
};

export type ApplicationReviewCommands = {
  StartReview: Command<typeof reviewActionInputSchema>;
  ReleaseApplication: Command<typeof reviewActionInputSchema>;
  ReturnApplication: Command<typeof reviewOutcomeInputSchema>;
  DenyApplication: Command<typeof reviewOutcomeInputSchema>;
  ApproveApplication: Command<typeof approveApplicationInputSchema>;
  SaveManagerNote: Command<typeof saveManagerNoteInputSchema, MutationResponse<ManagerNoteDto>>;
  RejectAllApplications: Command<
    typeof rejectAllApplicationsInputSchema,
    MutationResponse<{ affectedCount: number }>
  >;
};
