import assert from "node:assert/strict";
import test from "node:test";

import {
  EventPublicationError,
  FixedClock,
  InMemoryEventBus,
  SequenceIdGenerator,
  createCorrelationContext,
  createDomainEvent,
  type DomainEvent,
  type EventHandler,
} from "../src/index.ts";

interface InvoicePostedPayload {
  readonly invoiceId: string;
  readonly totalRials: number;
}

type InvoicePostedEvent = DomainEvent<
  InvoicePostedPayload,
  "sales.invoice-posted"
>;

function createInvoicePostedEvent(): InvoicePostedEvent {
  const idGenerator = new SequenceIdGenerator("event");
  const clock =
    new FixedClock("2026-07-25T12:00:00.000Z");

  const correlationContext = createCorrelationContext(
    new SequenceIdGenerator("correlation"),
    {
      userId: "user-1",
      companyId: "company-1",
      branchId: "branch-1",
    },
  );

  return createDomainEvent(
    {
      clock,
      idGenerator,
    },
    {
      eventType: "sales.invoice-posted",
      aggregateId: "invoice-100",
      aggregateType: "sales-invoice",
      aggregateVersion: 3,
      correlationContext,
      payload: {
        invoiceId: "invoice-100",
        totalRials: 1_500_000,
      },
      metadata: {
        source: "desktop",
      },
    },
  );
}

test("createDomainEvent creates stable event metadata", () => {
  const event = createInvoicePostedEvent();

  assert.equal(event.eventId, "event-1");
  assert.equal(event.eventType, "sales.invoice-posted");
  assert.equal(
    event.occurredAt,
    "2026-07-25T12:00:00.000Z",
  );
  assert.equal(event.aggregateId, "invoice-100");
  assert.equal(event.aggregateType, "sales-invoice");
  assert.equal(event.aggregateVersion, 3);
  assert.equal(event.correlationId, "correlation-1");
  assert.equal(event.payload.totalRials, 1_500_000);
  assert.equal(event.metadata.source, "desktop");
});

test("createDomainEvent rejects invalid event types", () => {
  assert.throws(
    () =>
      createDomainEvent(
        {
          clock: new FixedClock(
            "2026-07-25T12:00:00.000Z",
          ),
          idGenerator:
            new SequenceIdGenerator("event"),
        },
        {
          eventType: "InvoicePosted",
          payload: {},
        },
      ),
    TypeError,
  );
});

test("event bus publishes an event to a function handler", async () => {
  const eventBus = new InMemoryEventBus();
  const receivedEvents: InvoicePostedEvent[] = [];

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    (event) => {
      receivedEvents.push(event);
    },
  );

  const event = createInvoicePostedEvent();

  await eventBus.publish(event);

  assert.equal(receivedEvents.length, 1);
  assert.equal(
    receivedEvents[0]?.payload.invoiceId,
    "invoice-100",
  );
});

test("event bus supports object handlers", async () => {
  const eventBus = new InMemoryEventBus();
  let receivedInvoiceId: string | undefined;

  const handler: EventHandler<InvoicePostedEvent> = {
    handle(event) {
      receivedInvoiceId = event.payload.invoiceId;
    },
  };

  eventBus.subscribe(
    "sales.invoice-posted",
    handler,
  );

  await eventBus.publish(createInvoicePostedEvent());

  assert.equal(receivedInvoiceId, "invoice-100");
});

test("event handlers run in subscription order", async () => {
  const eventBus = new InMemoryEventBus();
  const executionOrder: number[] = [];

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    async () => {
      executionOrder.push(1);
    },
  );

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    () => {
      executionOrder.push(2);
    },
  );

  await eventBus.publish(createInvoicePostedEvent());

  assert.deepEqual(executionOrder, [1, 2]);
});

test("unsubscribed handlers do not receive future events", async () => {
  const eventBus = new InMemoryEventBus();
  let executionCount = 0;

  const unsubscribe =
    eventBus.subscribe<InvoicePostedEvent>(
      "sales.invoice-posted",
      () => {
        executionCount += 1;
      },
    );

  await eventBus.publish(createInvoicePostedEvent());

  unsubscribe();
  unsubscribe();

  await eventBus.publish(createInvoicePostedEvent());

  assert.equal(executionCount, 1);
  assert.equal(
    eventBus.countHandlers("sales.invoice-posted"),
    0,
  );
});

test("events without handlers are ignored safely", async () => {
  const eventBus = new InMemoryEventBus();

  await assert.doesNotReject(
    eventBus.publish(createInvoicePostedEvent()),
  );
});

test("all handlers run even when one handler fails", async () => {
  const eventBus = new InMemoryEventBus();
  const executedHandlers: string[] = [];

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    () => {
      executedHandlers.push("first");

      throw new Error("First handler failed.");
    },
  );

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    () => {
      executedHandlers.push("second");
    },
  );

  await assert.rejects(
    eventBus.publish(createInvoicePostedEvent()),
    (error: unknown) => {
      assert.ok(error instanceof EventPublicationError);
      assert.equal(error.code, "event.publication-failed");
      assert.equal(error.failures.length, 1);
      assert.equal(error.failures[0]?.handlerIndex, 0);

      return true;
    },
  );

  assert.deepEqual(
    executedHandlers,
    ["first", "second"],
  );
});

test("event bus collects multiple handler failures", async () => {
  const eventBus = new InMemoryEventBus();

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    () => {
      throw new Error("Handler one failed.");
    },
  );

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    async () => {
      throw new Error("Handler two failed.");
    },
  );

  await assert.rejects(
    eventBus.publish(createInvoicePostedEvent()),
    (error: unknown) => {
      assert.ok(error instanceof EventPublicationError);
      assert.equal(error.failures.length, 2);
      assert.equal(
        error.details.failureCount,
        2,
      );

      return true;
    },
  );
});

test("publishMany preserves event order", async () => {
  const eventBus = new InMemoryEventBus();
  const receivedEventIds: string[] = [];

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    (event) => {
      receivedEventIds.push(event.eventId);
    },
  );

  const first = createInvoicePostedEvent();

  const second: InvoicePostedEvent = {
    ...createInvoicePostedEvent(),
    eventId: "event-2",
  };

  await eventBus.publishMany([first, second]);

  assert.deepEqual(
    receivedEventIds,
    ["event-1", "event-2"],
  );
});

test("clear removes every registered handler", () => {
  const eventBus = new InMemoryEventBus();

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    () => {},
  );

  eventBus.subscribe<InvoicePostedEvent>(
    "sales.invoice-posted",
    () => {},
  );

  assert.equal(eventBus.countHandlers(), 2);

  eventBus.clear();

  assert.equal(eventBus.countHandlers(), 0);
});
