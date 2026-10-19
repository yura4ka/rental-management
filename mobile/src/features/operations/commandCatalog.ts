import { z } from "zod";
import type { IDatabaseQueries } from "@/services/database/types";
import type {
  EnqueueOperation,
  JournalOperation,
  JournalResponse,
  OperationRequestBody,
} from "./types";

/** A runtime parser; Zod schemas implement this interface without coupling handlers to Zod. */
export interface Schema<T> {
  parse(value: unknown): T;
}

/** The input/request/response relationship for one business command. */
export type CommandContract = {
  input: Record<string, unknown>;
  request: OperationRequestBody;
  response: JournalResponse;
};

export type CommandContracts = Record<string, CommandContract>;

export type PreparationContext = {
  metadata: OperationRequestBody;
  predecessorVersion: string | undefined;
};

/** Feature-owned behavior for one command. Delivery policy and journal state belong to the service. */
export type CommandHandler<C extends CommandContract> = {
  resourceType: string;
  inputSchema: Schema<C["input"]>;
  requestSchema: Schema<C["request"]>;
  responseSchema: Schema<C["response"]>;
  prepare(input: C["input"], context: PreparationContext): C["request"];
  execute(request: C["request"], signal: AbortSignal): Promise<C["response"]>;
  persist(response: C["response"], tx: IDatabaseQueries): Promise<void>;
};

/** Every declared command must have exactly one statically composed handler. */
export type CommandHandlers<C extends CommandContracts> = {
  readonly [K in keyof C]: CommandHandler<C[K]>;
};

/** Command names determine input types; callers cannot choose an unrelated response type. */
export type EnqueueCommand<C extends CommandContracts, K extends keyof C & string> = Omit<
  EnqueueOperation,
  "command" | "intent"
> & {
  command: K;
  intent: NoInfer<C[K]["input"]>;
};

/** A validated response bound to its feature writer, usable inside the finalization transaction. */
export type ValidatedOutcome = {
  response: JournalResponse;
  persist(tx: IDatabaseQueries): Promise<void>;
};

/** A validated frozen request bound to its executor; its typed payload never escapes as unchecked JSON. */
export type BoundCommand = {
  frozenRequestJson: string;
  execute(signal: AbortSignal): Promise<unknown>;
  receive(response: unknown): ValidatedOutcome;
};

export class CommandDataError extends Error {
  constructor(
    public readonly code: string,
    cause?: unknown,
  ) {
    super(code, { cause });
    this.name = "CommandDataError";
  }
}

// Older journals stored url/method too. Accept that envelope without rewriting its frozen JSON.
// API methods already owned routing in the original implementation; replay still uses those methods.
const frozenEnvelope = z
  .object({
    body: z.unknown(),
    url: z.string().optional(),
    method: z.enum(["POST", "PUT", "PATCH", "DELETE"]).optional(),
  })
  .strict();

/** Immutable composition and the sole runtime boundary for heterogeneous persisted commands. */
export class CommandCatalog<C extends CommandContracts> {
  private readonly handlers: CommandHandlers<C>;

  constructor(handlers: CommandHandlers<C>) {
    // Copy entries so later mutation of the factory's dictionary cannot change live dispatch.
    this.handlers = Object.freeze(
      Object.fromEntries(
        Object.entries(handlers).map(([key, handler]) => [key, Object.freeze({ ...handler })]),
      ),
    ) as CommandHandlers<C>;
  }

  validateInput<K extends keyof C & string>(command: K, input: unknown): C[K]["input"] {
    if (!Object.hasOwn(this.handlers, command)) throw new CommandDataError("UnsupportedCommand");
    return this.handlers[command].inputSchema.parse(input);
  }

  parseResponse<K extends keyof C & string>(command: K, response: unknown): C[K]["response"] {
    if (!Object.hasOwn(this.handlers, command)) throw new CommandDataError("UnsupportedCommand");
    return this.handlers[command].responseSchema.parse(response);
  }

  bind(operation: JournalOperation, predecessorVersion?: string): BoundCommand {
    const handler = this.lookup(operation.command);
    if (operation.payloadSchemaVersion !== 1)
      throw new CommandDataError("UnsupportedPayloadVersion");
    if (handler.resourceType !== operation.resourceType)
      throw new CommandDataError("InvalidResourceType");
    const input = this.parse("InvalidIntent", () =>
      handler.inputSchema.parse(JSON.parse(operation.intentJson)),
    );
    const request = this.parse("InvalidFrozenRequest", () =>
      handler.requestSchema.parse(
        operation.frozenRequestJson
          ? frozenEnvelope.parse(JSON.parse(operation.frozenRequestJson)).body
          : handler.prepare(input, {
              metadata: {
                operationId: operation.id,
                environmentGeneration: operation.environmentGeneration,
              },
              predecessorVersion,
            }),
      ),
    );
    if (
      request.operationId !== operation.id ||
      request.environmentGeneration !== operation.environmentGeneration
    ) {
      throw new CommandDataError("InvalidFrozenRequest");
    }
    return {
      frozenRequestJson: operation.frozenRequestJson ?? JSON.stringify({ body: request }),
      execute: (signal) => handler.execute(request, signal),
      receive: (raw) => {
        const response = this.parse("InvalidResponse", () => handler.responseSchema.parse(raw));
        if (response.operationId !== operation.id || response.outcome !== "Accepted") {
          throw new CommandDataError("InvalidResponse");
        }
        return { response, persist: (tx) => handler.persist(response, tx) };
      },
    };
  }

  private lookup(command: string): CommandHandler<CommandContract> {
    if (!Object.hasOwn(this.handlers, command)) throw new CommandDataError("UnsupportedCommand");
    // Erase the key-specific type only here. Each schema restores the matching shape before any
    // handler receives data, and bound closures keep request/response/writer associations together.
    return this.handlers[command] as CommandHandler<CommandContract>;
  }

  private parse<T>(code: string, read: () => T): T {
    try {
      return read();
    } catch (error) {
      throw new CommandDataError(code, error);
    }
  }
}
