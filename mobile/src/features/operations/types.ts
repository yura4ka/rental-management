export type OperationRequestBody = {
  operationId: string;
  environmentGeneration: string;
};

export type AffectedResourceDto = {
  resourceType: string;
  id: string;
  version: string | null;
};

export type MutationResponse<Data> = Data & {
  operationId: string;
  outcome: "Accepted";
  affectedResources: AffectedResourceDto[];
};

export type GetOperationRequestParams = {
  operationId: string;
  environmentGeneration: string;
};

export type GetOperationResponse = {
  operationId: string;
  outcome: string;
  httpStatus: number | null;
  response: unknown;
  responseSchemaVersion: number | null;
};

export interface IOperationsApi {
  getOperation(
    params: GetOperationRequestParams,
    signal?: AbortSignal,
  ): Promise<GetOperationResponse>;
}
