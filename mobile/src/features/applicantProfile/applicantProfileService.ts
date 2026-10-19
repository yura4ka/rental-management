import { HTTPError, NetworkError } from "@/services/api";
import type { INetwork } from "@/services/network";
import type { OperationsService } from "../operations/operationsService";
import type { OperationResult, OperationRequestBody } from "../operations/types";
import { ApplicantProfileRepository, type ProfileSection } from "./applicantProfileRepository";
import { profileInformationInput, profileResidencesInput } from "./applicantProfileValidation";
import type { ApplicantProfileCommands } from "./operations/types";
import type {
  GetApplicantProfileResponse,
  IApplicantProfileApi,
  UpdateApplicantInformationRequestBody,
  UpdateApplicantInformationResponse,
  UpdateResidenceHistoryRequestBody,
  UpdateResidenceHistoryResponse,
} from "./types";

type InformationInput = Omit<UpdateApplicantInformationRequestBody, keyof OperationRequestBody>;
type ResidencesInput = Omit<UpdateResidenceHistoryRequestBody, keyof OperationRequestBody>;

export class ApplicantProfileService {
  constructor(
    private readonly api: IApplicantProfileApi,
    private readonly repository: ApplicantProfileRepository,
    private readonly operations: OperationsService,
    private readonly network: INetwork,
    private readonly sessionSignal: AbortSignal,
  ) {}

  async get(): Promise<GetApplicantProfileResponse> {
    this.assertActive();
    if (!(await this.network.isOnline())) return this.requireCached();
    let response: GetApplicantProfileResponse;
    try {
      response = await this.api.getApplicantProfile(this.sessionSignal);
    } catch (error) {
      this.assertActive();
      if (
        error instanceof NetworkError ||
        (error instanceof HTTPError && [502, 503, 504].includes(error.status))
      ) {
        const cached = await this.repository.get();
        if (cached) return cached;
      }
      throw error;
    }
    this.assertActive();
    await this.repository.save(response);
    return this.requireCached();
  }

  updateApplicantInformation(
    input: InformationInput,
    options?: { replacesOperationId: string },
  ): Promise<OperationResult<UpdateApplicantInformationResponse>> {
    this.assertActive();
    const valid = profileInformationInput.parse(input);
    return this.update(
      "UpdateProfileInformation",
      "ApplicantInformation",
      valid,
      options?.replacesOperationId,
    );
  }

  updateResidenceHistory(
    input: ResidencesInput,
    options?: { replacesOperationId: string },
  ): Promise<OperationResult<UpdateResidenceHistoryResponse>> {
    this.assertActive();
    const valid = profileResidencesInput.parse(input);
    return this.update(
      "UpdateProfileResidences",
      "ResidenceHistory",
      valid,
      options?.replacesOperationId,
    );
  }

  saveDraft(
    section: ProfileSection,
    input: Record<string, unknown>,
    baseVersion: string | null = null,
  ): Promise<void> {
    this.assertActive();
    return this.repository.saveDraft(section, input, baseVersion);
  }

  getDraft(section: ProfileSection): Promise<Record<string, unknown> | null> {
    this.assertActive();
    return this.repository.getDraft(section);
  }

  private async update<K extends keyof ApplicantProfileCommands>(
    command: K,
    section: ProfileSection,
    intent: ApplicantProfileCommands[K]["input"],
    replacesOperationId?: string,
  ): Promise<OperationResult<ApplicantProfileCommands[K]["response"]>> {
    const applicantId = await this.repository.getApplicantId();
    return this.operations.perform<K>(
      {
        command,
        resourceType: "Profile",
        resourceId: applicantId,
        intent,
        replacesOperationId,
      },
      (operation, tx) => this.repository.saveIntent(operation, section, tx),
    );
  }

  private async requireCached(): Promise<GetApplicantProfileResponse> {
    this.assertActive();
    const cached = await this.repository.get();
    if (!cached) throw new Error("No downloaded applicant profile is available offline.");
    return cached;
  }

  private assertActive(): void {
    if (this.sessionSignal.aborted) throw new Error("The session is no longer active.");
  }
}
