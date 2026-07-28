export interface Command<
  TCommandType extends string = string,
> {
  readonly commandType: TCommandType;
}

export interface CommandHandler<
  TCommand extends Command,
  TResult = void,
> {
  handle(command: TCommand): Promise<TResult> | TResult;
}

export type CommandHandlerFunction<
  TCommand extends Command,
  TResult = void,
> = (
  command: TCommand,
) => Promise<TResult> | TResult;

export interface CommandBus {
  execute<
    TResult,
    TCommand extends Command = Command,
  >(
    command: TCommand,
  ): Promise<TResult>;
}
