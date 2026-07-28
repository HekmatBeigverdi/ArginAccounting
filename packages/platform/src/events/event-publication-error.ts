import { PlatformError } from "../common/index.ts";
import type { DomainEvent } from "./domain-event.ts";

export interface EventHandlerFailure {
  readonly handlerIndex: number;
  readonly cause: unknown;
}

export class EventPublicationError extends PlatformError {
  readonly event: DomainEvent;
  readonly failures: readonly EventHandlerFailure[];

  constructor(
    event: DomainEvent,
    failures: readonly EventHandlerFailure[],
  ) {
    const aggregateCause = new AggregateError(
      failures.map((failure) => failure.cause),
      `One or more handlers failed for event "${event.eventType}".`,
    );

    super({
      code: "event.publication-failed",
      message:
        `Failed to publish event "${event.eventType}" ` +
        `to ${failures.length} handler(s).`,
      category: "infrastructure",
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        failureCount: failures.length,
      },
      cause: aggregateCause,
    });

    this.name = "EventPublicationError";
    this.event = event;
    this.failures = failures;
  }
}
