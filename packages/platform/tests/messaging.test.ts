import assert from "node:assert/strict";
import test from "node:test";

import {
  DuplicateMessageHandlerError,
  InMemoryCommandBus,
  InMemoryQueryBus,
  MessageHandlerNotFoundError,
  PlatformError,
  type Command,
  type CommandHandler,
  type Query,
  type QueryHandler,
} from "../src/index.ts";

interface CreateInvoiceResult {
  readonly invoiceId: string;
}

interface CreateInvoiceCommand
  extends Command<"sales.create-invoice"> {
  readonly customerId: string;
  readonly totalRials: number;
}

interface InvoiceView {
  readonly invoiceId: string;
  readonly customerName: string;
  readonly totalRials: number;
}

interface GetInvoiceQuery
  extends Query<
    InvoiceView | undefined,
    "sales.get-invoice"
  > {
  readonly invoiceId: string;
}

test("command bus executes a function handler", async () => {
  const commandBus = new InMemoryCommandBus();

  commandBus.register<
    CreateInvoiceCommand,
    CreateInvoiceResult
  >(
    "sales.create-invoice",
    (command) => ({
      invoiceId:
        `${command.customerId}-${command.totalRials}`,
    }),
  );

  const result =
    await commandBus.execute<
      CreateInvoiceResult,
      CreateInvoiceCommand
    >({
      commandType: "sales.create-invoice",
      customerId: "customer-1",
      totalRials: 1_500_000,
    });

  assert.deepEqual(result, {
    invoiceId: "customer-1-1500000",
  });
});

test("command bus supports object handlers", async () => {
  const commandBus = new InMemoryCommandBus();
  let receivedCustomerId: string | undefined;

  const handler:
    CommandHandler<
      CreateInvoiceCommand,
      CreateInvoiceResult
    > = {
      handle(command) {
        receivedCustomerId = command.customerId;

        return {
          invoiceId: "invoice-100",
        };
      },
    };

  commandBus.register(
    "sales.create-invoice",
    handler,
  );

  const result =
    await commandBus.execute<
      CreateInvoiceResult,
      CreateInvoiceCommand
    >({
      commandType: "sales.create-invoice",
      customerId: "customer-1",
      totalRials: 500_000,
    });

  assert.equal(receivedCustomerId, "customer-1");
  assert.equal(result.invoiceId, "invoice-100");
});

test("command bus awaits asynchronous handlers", async () => {
  const commandBus = new InMemoryCommandBus();

  commandBus.register<
    CreateInvoiceCommand,
    CreateInvoiceResult
  >(
    "sales.create-invoice",
    async () => {
      await Promise.resolve();

      return {
        invoiceId: "invoice-async",
      };
    },
  );

  const result =
    await commandBus.execute<
      CreateInvoiceResult,
      CreateInvoiceCommand
    >({
      commandType: "sales.create-invoice",
      customerId: "customer-1",
      totalRials: 100,
    });

  assert.equal(result.invoiceId, "invoice-async");
});

test("query bus executes a function handler", async () => {
  const queryBus = new InMemoryQueryBus();

  queryBus.register<
    GetInvoiceQuery,
    InvoiceView | undefined
  >(
    "sales.get-invoice",
    (query) => ({
      invoiceId: query.invoiceId,
      customerName: "شرکت نمونه",
      totalRials: 2_000_000,
    }),
  );

  const result =
    await queryBus.ask<
      InvoiceView | undefined,
      GetInvoiceQuery
    >({
      queryType: "sales.get-invoice",
      invoiceId: "invoice-200",
    });

  assert.deepEqual(result, {
    invoiceId: "invoice-200",
    customerName: "شرکت نمونه",
    totalRials: 2_000_000,
  });
});

test("query bus supports object handlers", async () => {
  const queryBus = new InMemoryQueryBus();

  const handler:
    QueryHandler<
      GetInvoiceQuery,
      InvoiceView | undefined
    > = {
      handle(query) {
        return {
          invoiceId: query.invoiceId,
          customerName: "مشتری آزمایشی",
          totalRials: 750_000,
        };
      },
    };

  queryBus.register(
    "sales.get-invoice",
    handler,
  );

  const result =
    await queryBus.ask<
      InvoiceView | undefined,
      GetInvoiceQuery
    >({
      queryType: "sales.get-invoice",
      invoiceId: "invoice-300",
    });

  assert.equal(result?.customerName, "مشتری آزمایشی");
});

test("command bus rejects duplicate handlers", () => {
  const commandBus = new InMemoryCommandBus();

  commandBus.register<
    CreateInvoiceCommand,
    CreateInvoiceResult
  >(
    "sales.create-invoice",
    () => ({
      invoiceId: "invoice-1",
    }),
  );

  assert.throws(
    () =>
      commandBus.register<
        CreateInvoiceCommand,
        CreateInvoiceResult
      >(
        "sales.create-invoice",
        () => ({
          invoiceId: "invoice-2",
        }),
      ),
    (error: unknown) =>
      error instanceof DuplicateMessageHandlerError &&
      error.code === "messaging.duplicate-handler" &&
      error.messageKind === "command",
  );
});

test("query bus rejects duplicate handlers", () => {
  const queryBus = new InMemoryQueryBus();

  queryBus.register<
    GetInvoiceQuery,
    InvoiceView | undefined
  >(
    "sales.get-invoice",
    () => undefined,
  );

  assert.throws(
    () =>
      queryBus.register<
        GetInvoiceQuery,
        InvoiceView | undefined
      >(
        "sales.get-invoice",
        () => undefined,
      ),
    (error: unknown) =>
      error instanceof DuplicateMessageHandlerError &&
      error.messageKind === "query",
  );
});

test("command bus reports a missing handler", async () => {
  const commandBus = new InMemoryCommandBus();

  await assert.rejects(
    commandBus.execute<
      CreateInvoiceResult,
      CreateInvoiceCommand
    >({
      commandType: "sales.create-invoice",
      customerId: "customer-1",
      totalRials: 100,
    }),
    (error: unknown) =>
      error instanceof MessageHandlerNotFoundError &&
      error.code === "messaging.handler-not-found" &&
      error.messageKind === "command" &&
      error.messageType === "sales.create-invoice",
  );
});

test("query bus reports a missing handler", async () => {
  const queryBus = new InMemoryQueryBus();

  await assert.rejects(
    queryBus.ask<
      InvoiceView | undefined,
      GetInvoiceQuery
    >({
      queryType: "sales.get-invoice",
      invoiceId: "missing",
    }),
    (error: unknown) =>
      error instanceof MessageHandlerNotFoundError &&
      error.messageKind === "query",
  );
});

test("handler errors are preserved without wrapping", async () => {
  const commandBus = new InMemoryCommandBus();

  const validationError = PlatformError.validation(
    "sales.invalid-total",
    "Invoice total is invalid.",
  );

  commandBus.register<
    CreateInvoiceCommand,
    CreateInvoiceResult
  >(
    "sales.create-invoice",
    () => {
      throw validationError;
    },
  );

  await assert.rejects(
    commandBus.execute<
      CreateInvoiceResult,
      CreateInvoiceCommand
    >({
      commandType: "sales.create-invoice",
      customerId: "customer-1",
      totalRials: -1,
    }),
    (error: unknown) => error === validationError,
  );
});

test("message types must use module-prefixed notation", () => {
  const commandBus = new InMemoryCommandBus();

  assert.throws(
    () =>
      commandBus.register(
        "CreateInvoice",
        () => undefined,
      ),
    TypeError,
  );

  const queryBus = new InMemoryQueryBus();

  assert.throws(
    () =>
      queryBus.register(
        "get-invoice",
        () => undefined,
      ),
    TypeError,
  );
});

test("handlers can be inspected and unregistered", () => {
  const commandBus = new InMemoryCommandBus();

  commandBus.register<
    CreateInvoiceCommand,
    CreateInvoiceResult
  >(
    "sales.create-invoice",
    () => ({
      invoiceId: "invoice-1",
    }),
  );

  assert.equal(commandBus.handlerCount, 1);
  assert.equal(
    commandBus.hasHandler("sales.create-invoice"),
    true,
  );

  assert.equal(
    commandBus.unregister("sales.create-invoice"),
    true,
  );

  assert.equal(commandBus.handlerCount, 0);
  assert.equal(
    commandBus.hasHandler("sales.create-invoice"),
    false,
  );

  assert.equal(
    commandBus.unregister("sales.create-invoice"),
    false,
  );
});

test("clear removes command and query handlers", () => {
  const commandBus = new InMemoryCommandBus();
  const queryBus = new InMemoryQueryBus();

  commandBus.register<
    CreateInvoiceCommand,
    CreateInvoiceResult
  >(
    "sales.create-invoice",
    () => ({
      invoiceId: "invoice-1",
    }),
  );

  queryBus.register<
    GetInvoiceQuery,
    InvoiceView | undefined
  >(
    "sales.get-invoice",
    () => undefined,
  );

  commandBus.clear();
  queryBus.clear();

  assert.equal(commandBus.handlerCount, 0);
  assert.equal(queryBus.handlerCount, 0);
});
