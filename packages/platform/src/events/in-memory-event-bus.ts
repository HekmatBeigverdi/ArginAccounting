import type { DomainEvent } from "./domain-event.ts";
import type { EventBus } from "./event-bus.ts";
import type {
  EventHandler,
  EventHandlerFunction,
  UnsubscribeFromEvent,
} from "./event-handler.ts";
import {
  EventPublicationError,
  type EventHandlerFailure,
} from "./event-publication-error.ts";

type RegisteredHandler = EventHandlerFunction<DomainEvent>;

export class InMemoryEventBus implements EventBus {
  readonly #handlers =
    new Map<string, RegisteredHandler[]>();

  subscribe<TEvent extends DomainEvent>(
    eventType: TEvent["eventType"],
    handler:
      | EventHandler<TEvent>
      | EventHandlerFunction<TEvent>,
  ): UnsubscribeFromEvent {
    const normalizedEventType = eventType.trim();

    if (normalizedEventType.length === 0) {
      throw new TypeError(
        "Subscribed event type must not be empty.",
      );
    }

    const registeredHandler = this.toFunction(handler);
    const handlers =
      this.#handlers.get(normalizedEventType) ?? [];

    handlers.push(registeredHandler);
    this.#handlers.set(normalizedEventType, handlers);

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;

      const currentHandlers =
        this.#handlers.get(normalizedEventType);

      if (currentHandlers === undefined) {
        return;
      }

      const handlerIndex =
        currentHandlers.indexOf(registeredHandler);

      if (handlerIndex >= 0) {
        currentHandlers.splice(handlerIndex, 1);
      }

      if (currentHandlers.length === 0) {
        this.#handlers.delete(normalizedEventType);
      }
    };
  }

  async publish<TEvent extends DomainEvent>(
    event: TEvent,
  ): Promise<void> {
    const handlers = [
      ...(this.#handlers.get(event.eventType) ?? []),
    ];

    if (handlers.length === 0) {
      return;
    }

    const failures: EventHandlerFailure[] = [];

    for (
      let handlerIndex = 0;
      handlerIndex < handlers.length;
      handlerIndex += 1
    ) {
      const handler = handlers[handlerIndex];

      if (handler === undefined) {
        continue;
      }

      try {
        await handler(event);
      } catch (cause: unknown) {
        failures.push({
          handlerIndex,
          cause,
        });
      }
    }

    if (failures.length > 0) {
      throw new EventPublicationError(event, failures);
    }
  }

  async publishMany(
    events: readonly DomainEvent[],
  ): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  clear(): void {
    this.#handlers.clear();
  }

  countHandlers(eventType?: string): number {
    if (eventType !== undefined) {
      return this.#handlers.get(eventType)?.length ?? 0;
    }

    let total = 0;

    for (const handlers of this.#handlers.values()) {
      total += handlers.length;
    }

    return total;
  }

  private toFunction<TEvent extends DomainEvent>(
    handler:
      | EventHandler<TEvent>
      | EventHandlerFunction<TEvent>,
  ): RegisteredHandler {
    if (typeof handler === "function") {
      return handler as RegisteredHandler;
    }

    return (
      event: DomainEvent,
    ): Promise<void> | void => {
      return handler.handle(event as TEvent);
    };
  }
}
