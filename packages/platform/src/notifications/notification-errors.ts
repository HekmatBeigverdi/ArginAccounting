import { PlatformError } from "../common/index.ts";

export class NotificationNotFoundError
  extends PlatformError {
  readonly notificationId: string;

  constructor(notificationId: string) {
    super({
      code: "notification.not-found",
      message:
        `Notification "${notificationId}" ` +
        "was not found.",
      category: "not-found",
      details: {
        notificationId,
      },
    });

    this.name = "NotificationNotFoundError";
    this.notificationId = notificationId;
  }
}

export class DuplicateNotificationError
  extends PlatformError {
  readonly notificationId: string;

  constructor(notificationId: string) {
    super({
      code: "notification.duplicate",
      message:
        `Notification "${notificationId}" ` +
        "already exists.",
      category: "conflict",
      details: {
        notificationId,
      },
    });

    this.name = "DuplicateNotificationError";
    this.notificationId = notificationId;
  }
}
