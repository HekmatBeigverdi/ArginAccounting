import type {
  Clock,
  CorrelationContext,
  IdGenerator,
} from "../common/index.ts";

export interface DomainEvent<
  TPayload = unknown,
  TEventType extends string = string,
> {
  readonly eventId: string;
  readonly eventType: TEventType;
  readonly occurredAt: string;
  readonly aggregateId?: string;
  readonly aggregateType?: string;
  readonly aggregateVersion?: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly payload: Readonly<TPayload>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CreateDomainEventInput<
  TPayload,
  TEventType extends string,
> {
  readonly eventType: TEventType;
  readonly payload: Readonly<TPayload>;
  readonly aggregateId?: string;
  readonly aggregateType?: string;
  readonly aggregateVersion?: number;
  readonly correlationContext?: CorrelationContext;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DomainEventFactoryDependencies {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export function createDomainEvent<
  TPayload,
  TEventType extends string,
>(
  dependencies: DomainEventFactoryDependencies,
  input: CreateDomainEventInput<TPayload, TEventType>,
): DomainEvent<TPayload, TEventType> {
  assertEventType(input.eventType);
  assertAggregateVersion(input.aggregateVersion);

  return {
    eventId: dependencies.idGenerator.generate(),
    eventType: input.eventType,
    occurredAt: dependencies.clock.nowIso(),
    ...(input.aggregateId === undefined
      ? {}
      : { aggregateId: input.aggregateId }),
    ...(input.aggregateType === undefined
      ? {}
      : { aggregateType: input.aggregateType }),
    ...(input.aggregateVersion === undefined
      ? {}
      : { aggregateVersion: input.aggregateVersion }),
    ...(input.correlationContext?.correlationId === undefined
      ? {}
      : {
          correlationId:
            input.correlationContext.correlationId,
        }),
    ...(input.correlationContext?.causationId === undefined
      ? {}
      : {
          causationId:
            input.correlationContext.causationId,
        }),
    payload: input.payload,
    metadata: input.metadata ?? {},
  };
}

function assertEventType(eventType: string): void {
  if (eventType.trim().length === 0) {
    throw new TypeError(
      "Domain event type must not be empty.",
    );
  }

  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/.test(eventType)) {
    throw new TypeError(
      "Domain event type must use lowercase dot-separated notation.",
    );
  }
}

function assertAggregateVersion(
  aggregateVersion: number | undefined,
): void {
  if (
    aggregateVersion !== undefined &&
    (
      !Number.isSafeInteger(aggregateVersion) ||
      aggregateVersion < 0
    )
  ) {
    throw new RangeError(
      "Aggregate version must be a non-negative safe integer.",
    );
  }
}
