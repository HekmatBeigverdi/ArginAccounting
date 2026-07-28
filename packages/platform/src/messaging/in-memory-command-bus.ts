import type {
  Command,
  CommandBus,
  CommandHandler,
  CommandHandlerFunction,
} from "./command.ts";
import {
  DuplicateMessageHandlerError,
  MessageHandlerNotFoundError,
} from "./messaging-errors.ts";
import { normalizeMessageType } from "./message-type.ts";

type RegisteredCommandHandler = (
  command: Command,
) => Promise<unknown> | unknown;

export class InMemoryCommandBus implements CommandBus {
  readonly #handlers =
    new Map<string, RegisteredCommandHandler>();

  register<TCommand extends Command, TResult>(
    commandType: TCommand["commandType"],
    handler:
      | CommandHandler<TCommand, TResult>
      | CommandHandlerFunction<TCommand, TResult>,
  ): void {
    const normalizedCommandType = normalizeMessageType(
      commandType,
      "command",
    );

    if (this.#handlers.has(normalizedCommandType)) {
      throw new DuplicateMessageHandlerError(
        "command",
        normalizedCommandType,
      );
    }

    this.#handlers.set(
      normalizedCommandType,
      this.toFunction(handler),
    );
  }

  async execute<
    TResult,
    TCommand extends Command = Command,
  >(
    command: TCommand,
  ): Promise<TResult> {
    const commandType = normalizeMessageType(
      command.commandType,
      "command",
    );

    const handler = this.#handlers.get(commandType);

    if (handler === undefined) {
      throw new MessageHandlerNotFoundError(
        "command",
        commandType,
      );
    }

    return await handler(command) as TResult;
  }

  hasHandler(commandType: string): boolean {
    return this.#handlers.has(commandType.trim());
  }

  unregister(commandType: string): boolean {
    return this.#handlers.delete(commandType.trim());
  }

  clear(): void {
    this.#handlers.clear();
  }

  get handlerCount(): number {
    return this.#handlers.size;
  }

  private toFunction<
    TCommand extends Command,
    TResult,
  >(
    handler:
      | CommandHandler<TCommand, TResult>
      | CommandHandlerFunction<TCommand, TResult>,
  ): RegisteredCommandHandler {
    if (typeof handler === "function") {
      return handler as RegisteredCommandHandler;
    }

    return (command: Command): Promise<TResult> | TResult => {
      return handler.handle(command as TCommand);
    };
  }
}
