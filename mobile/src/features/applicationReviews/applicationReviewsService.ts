import type { ApplicationsRepository } from "@/features/applications/applicationsRepository";
import type { ApplicationMutationOptions } from "@/features/applications/applicationsService";
import type { OperationsService } from "@/features/operations/operationsService";
import type { ApplicationReviewsRepository } from "./applicationReviewsRepository";
import type { ApplicationReviewCommands } from "./operations/types";
import * as schemas from "./operations/schemas";

type ReviewCommand = Exclude<
  keyof ApplicationReviewCommands,
  "SaveManagerNote" | "RejectAllApplications"
>;

export class ApplicationReviewsService {
  constructor(
    private readonly applications: ApplicationsRepository,
    private readonly repository: ApplicationReviewsRepository,
    private readonly operations: OperationsService,
    private readonly sessionSignal: AbortSignal,
  ) {}

  startReview(
    input: ApplicationReviewCommands["StartReview"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    return this.review("StartReview", schemas.reviewActionInputSchema.parse(input), options);
  }

  releaseApplication(
    input: ApplicationReviewCommands["ReleaseApplication"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    return this.review("ReleaseApplication", schemas.reviewActionInputSchema.parse(input), options);
  }

  returnApplication(
    input: ApplicationReviewCommands["ReturnApplication"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    return this.review("ReturnApplication", schemas.reviewOutcomeInputSchema.parse(input), options);
  }

  denyApplication(
    input: ApplicationReviewCommands["DenyApplication"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    return this.review("DenyApplication", schemas.reviewOutcomeInputSchema.parse(input), options);
  }

  approveApplication(
    input: ApplicationReviewCommands["ApproveApplication"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    return this.review(
      "ApproveApplication",
      schemas.approveApplicationInputSchema.parse(input),
      options,
    );
  }

  async saveManagerNote(
    input: ApplicationReviewCommands["SaveManagerNote"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    await this.assertManager();
    const intent = schemas.saveManagerNoteInputSchema.parse(input);
    await this.requireDetail(intent.id);
    return this.operations.perform(
      {
        command: "SaveManagerNote",
        resourceType: "ManagerNote",
        resourceId: intent.id,
        intent,
        ...options,
      },
      (operation, tx) =>
        this.repository.saveNoteIntent(
          operation.id,
          intent.id,
          intent.body,
          intent.expectedVersion,
          tx,
        ),
    );
  }

  async saveNoteDraft(id: string, body: string, expectedVersion: string | null) {
    await this.assertManager();
    return this.repository.saveNoteInput(id, body, expectedVersion);
  }

  async getNoteDraft(id: string) {
    await this.assertManager();
    return this.repository.getNoteInput(id);
  }

  async rejectAllApplications(
    input: ApplicationReviewCommands["RejectAllApplications"]["input"],
    options?: ApplicationMutationOptions,
  ) {
    await this.assertManager();
    const intent = schemas.rejectAllApplicationsInputSchema.parse(input);
    // No expected versions or captured application IDs: the server selects at execution time.
    return this.operations.perform({
      command: "RejectAllApplications",
      resourceType: "Unit",
      resourceId: intent.unitId,
      intent,
      ...options,
    });
  }

  private async review<K extends ReviewCommand>(
    command: K,
    intent: ApplicationReviewCommands[K]["input"],
    options?: ApplicationMutationOptions,
  ) {
    await this.assertManager();
    const detail = await this.requireDetail(intent.id);
    const pending = (await this.operations.getAll()).filter(
      (o) =>
        o.resourceType === "Application" &&
        o.resourceId === intent.id &&
        ["Queued", "Dispatched", "Rejected"].includes(o.state) &&
        !o.dismissedAt &&
        o.id !== options?.replacesOperationId,
    );
    if (pending.some((o) => o.command !== "StartReview"))
      throw new Error("Resolve the pending application action before reviewing.");
    const status = pending.some((o) => o.command === "StartReview")
      ? "InReview"
      : detail.application.status;
    if (status !== (command === "StartReview" ? "Submitted" : "InReview"))
      throw new Error("This review action is not available in the current application status.");
    return this.operations.perform(
      {
        command,
        resourceType: "Application",
        resourceId: intent.id,
        intent,
        ...options,
        resources: [
          {
            resourceType: "Unit",
            resourceId: detail.application.unitId,
            accessMode: command === "ApproveApplication" ? "Write" : "Read",
          },
        ],
      },
      (operation, tx) =>
        this.applications.assertNoPendingAction(
          intent.id,
          detail.application.unitId,
          operation.id,
          command !== "StartReview",
          tx,
        ),
    );
  }

  private async requireDetail(id: string) {
    const detail = await this.applications.getDetail(id);
    if (!detail) throw new Error("Download the complete application before reviewing it.");
    return detail;
  }

  private async assertManager() {
    if (this.sessionSignal.aborted) throw new Error("The session is no longer active.");
    const account = await this.applications.account();
    if (account.role !== "PropertyManager")
      throw new Error("Only managers can review applications or save private notes.");
  }
}
