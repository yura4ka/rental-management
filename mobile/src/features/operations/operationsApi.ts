import type { HTTPTransport } from "@/services/api";
import type { GetOperationRequestParams, GetOperationResponse, IOperationsApi } from "./types";

export class OperationsApi implements IOperationsApi {
  constructor(private readonly api: HTTPTransport) {}

  getOperation(
    params: GetOperationRequestParams,
    signal?: AbortSignal,
  ): Promise<GetOperationResponse> {
    return this.api.fetch<GetOperationResponse>({
      url: `/api/operations/${encodeURIComponent(params.operationId)}`,
      params: { environmentGeneration: params.environmentGeneration },
      signal,
    });
  }
}
