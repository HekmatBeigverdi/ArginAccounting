import type { IdGenerator } from "./id-generator.ts";

export interface CorrelationContext {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly companyId?: string;
  readonly branchId?: string;
}

export interface CorrelationContextAccessor {
  getCurrent(): CorrelationContext | undefined;
}

export class StaticCorrelationContextAccessor
  implements CorrelationContextAccessor
{
  readonly #context: CorrelationContext | undefined;

  constructor(context?: CorrelationContext) {
    this.#context = context;
  }

  getCurrent(): CorrelationContext | undefined {
    return this.#context;
  }
}

export function createCorrelationContext(
  idGenerator: IdGenerator,
  values: Omit<CorrelationContext, "correlationId"> & {
    correlationId?: string;
  } = {},
): CorrelationContext {
  return {
    ...values,
    correlationId: values.correlationId ?? idGenerator.generate(),
  };
}

export function createChildCorrelationContext(
  parent: CorrelationContext,
  idGenerator: IdGenerator,
): CorrelationContext {
  return {
    ...parent,
    correlationId: idGenerator.generate(),
    causationId: parent.correlationId,
  };
}
