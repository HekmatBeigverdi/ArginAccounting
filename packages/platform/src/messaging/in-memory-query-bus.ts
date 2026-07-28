import type {
  Query,
  QueryBus,
  QueryHandler,
  QueryHandlerFunction,
} from "./query.ts";
import {
  DuplicateMessageHandlerError,
  MessageHandlerNotFoundError,
} from "./messaging-errors.ts";
import { normalizeMessageType } from "./message-type.ts";

type RegisteredQueryHandler = (
  query: Query,
) => Promise<unknown> | unknown;

export class InMemoryQueryBus implements QueryBus {
  readonly #handlers =
    new Map<string, RegisteredQueryHandler>();

  register<TQuery extends Query<TResult>, TResult>(
    queryType: TQuery["queryType"],
    handler:
      | QueryHandler<TQuery, TResult>
      | QueryHandlerFunction<TQuery, TResult>,
  ): void {
    const normalizedQueryType = normalizeMessageType(
      queryType,
      "query",
    );

    if (this.#handlers.has(normalizedQueryType)) {
      throw new DuplicateMessageHandlerError(
        "query",
        normalizedQueryType,
      );
    }

    this.#handlers.set(
      normalizedQueryType,
      this.toFunction(handler),
    );
  }

  async ask<
    TResult,
    TQuery extends Query<TResult> = Query<TResult>,
  >(
    query: TQuery,
  ): Promise<TResult> {
    const queryType = normalizeMessageType(
      query.queryType,
      "query",
    );

    const handler = this.#handlers.get(queryType);

    if (handler === undefined) {
      throw new MessageHandlerNotFoundError(
        "query",
        queryType,
      );
    }

    return await handler(query) as TResult;
  }

  hasHandler(queryType: string): boolean {
    return this.#handlers.has(queryType.trim());
  }

  unregister(queryType: string): boolean {
    return this.#handlers.delete(queryType.trim());
  }

  clear(): void {
    this.#handlers.clear();
  }

  get handlerCount(): number {
    return this.#handlers.size;
  }

  private toFunction<
    TQuery extends Query<TResult>,
    TResult,
  >(
    handler:
      | QueryHandler<TQuery, TResult>
      | QueryHandlerFunction<TQuery, TResult>,
  ): RegisteredQueryHandler {
    if (typeof handler === "function") {
      return handler as RegisteredQueryHandler;
    }

    return (query: Query): Promise<TResult> | TResult => {
      return handler.handle(query as TQuery);
    };
  }
}
