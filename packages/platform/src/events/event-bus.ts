import type { DomainEvent } from "./domain-event.ts";
import type {
  EventHandler,
  EventHandlerFunction,
  UnsubscribeFromEvent,
} from "./event-handler.ts";

export interface EventBus {
  subscribe<TEvent extends DomainEvent>(
    eventType: TEvent["eventType"],
    handler:
      | EventHandler<TEvent>
      | EventHandlerFunction<TEvent>,
  ): UnsubscribeFromEvent;

  publish<TEvent extends DomainEvent>(
    event: TEvent,
  ): Promise<void>;

  publishMany(
    events: readonly DomainEvent[],
  ): Promise<void>;
}
