import {
  DuplicateNotificationError,
} from "./notification-errors.ts";
import type {
  NotificationStore,
} from "./notification-store.ts";
import type {
  Notification,
  NotificationQuery,
} from "./notification.ts";
import {
  normalizeNotificationId,
  normalizeNotificationQuery,
} from "./notification-validation.ts";

export class InMemoryNotificationStore
  implements NotificationStore {
  readonly #notifications =
    new Map<string, Notification>();

  async save(
    notification: Notification,
  ): Promise<void> {
    if (
      this.#notifications.has(
        notification.notificationId,
      )
    ) {
      throw new DuplicateNotificationError(
        notification.notificationId,
      );
    }

    this.#notifications.set(
      notification.notificationId,
      notification,
    );
  }

  async getById(
    notificationId: string,
  ): Promise<Notification | undefined> {
    return this.#notifications.get(
      normalizeNotificationId(notificationId),
    );
  }

  async list(
    query: NotificationQuery,
    now: Date,
  ): Promise<readonly Notification[]> {
    const normalized =
      normalizeNotificationQuery(query);

    return [...this.#notifications.values()]
      .filter(
        (notification) =>
          notification.recipient.recipientType ===
            normalized.recipientType &&
          notification.recipient.recipientId ===
            normalized.recipientId,
      )
      .filter(
        (notification) =>
          normalized.unreadOnly !== true ||
          notification.readAt === undefined,
      )
      .filter(
        (notification) =>
          normalized.includeExpired === true ||
          notification.expiresAt === undefined ||
          notification.expiresAt.getTime() >
            now.getTime(),
      )
      .sort(
        (left, right) =>
          right.createdAt.getTime() -
          left.createdAt.getTime(),
      )
      .slice(0, normalized.limit);
  }

  async markAsRead(
    notificationId: string,
    readAt: Date,
  ): Promise<Notification | undefined> {
    const normalizedId =
      normalizeNotificationId(notificationId);

    const existing =
      this.#notifications.get(normalizedId);

    if (existing === undefined) {
      return undefined;
    }

    if (existing.readAt !== undefined) {
      return existing;
    }

    const updated = Object.freeze({
      ...existing,
      readAt: new Date(readAt.getTime()),
    });

    this.#notifications.set(
      normalizedId,
      updated,
    );

    return updated;
  }

  async markAllAsRead(
    query: NotificationQuery,
    readAt: Date,
  ): Promise<number> {
    const normalized =
      normalizeNotificationQuery(query);

    let updatedCount = 0;

    for (
      const [notificationId, notification]
      of this.#notifications
    ) {
      if (
        notification.recipient.recipientType !==
          normalized.recipientType ||
        notification.recipient.recipientId !==
          normalized.recipientId ||
        notification.readAt !== undefined
      ) {
        continue;
      }

      this.#notifications.set(
        notificationId,
        Object.freeze({
          ...notification,
          readAt: new Date(readAt.getTime()),
        }),
      );

      updatedCount += 1;
    }

    return updatedCount;
  }

  get notificationCount(): number {
    return this.#notifications.size;
  }

  clear(): void {
    this.#notifications.clear();
  }
}
