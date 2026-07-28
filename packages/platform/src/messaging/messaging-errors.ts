import { PlatformError } from "../common/index.ts";

export class MessageHandlerNotFoundError
  extends PlatformError {
  readonly messageKind: "command" | "query";
  readonly messageType: string;

  constructor(
    messageKind: "command" | "query",
    messageType: string,
  ) {
    super({
      code: "messaging.handler-not-found",
      message:
        `No ${messageKind} handler is registered for ` +
        `"${messageType}".`,
      category: "infrastructure",
      details: {
        messageKind,
        messageType,
      },
    });

    this.name = "MessageHandlerNotFoundError";
    this.messageKind = messageKind;
    this.messageType = messageType;
  }
}

export class DuplicateMessageHandlerError
  extends PlatformError {
  readonly messageKind: "command" | "query";
  readonly messageType: string;

  constructor(
    messageKind: "command" | "query",
    messageType: string,
  ) {
    super({
      code: "messaging.duplicate-handler",
      message:
        `A ${messageKind} handler is already registered for ` +
        `"${messageType}".`,
      category: "conflict",
      details: {
        messageKind,
        messageType,
      },
    });

    this.name = "DuplicateMessageHandlerError";
    this.messageKind = messageKind;
    this.messageType = messageType;
  }
}
