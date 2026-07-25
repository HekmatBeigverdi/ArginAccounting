import type { DomainEvent } from "./domain-event.ts";

export interface EventHandler<
  TEvent extends DomainEvent = DomainEvent,
> {
  handle(event: TEvent): Promise<void> | void;
}

export type EventHandlerFunction<
  TEvent extends DomainEvent = DomainEvent,
> = (
  event: TEvent,
) => Promise<void> | void;

export type UnsubscribeFromEvent = () => void;
