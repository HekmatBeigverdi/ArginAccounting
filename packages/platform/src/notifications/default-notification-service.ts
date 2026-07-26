import {
  NotificationNotFoundError,
} from "./notification-errors.ts";
import type {
  NotificationClock,
  NotificationIdGenerator,
} from "./notification-runtime.ts";
import {
  SystemNotificationClock,
  UuidNotificationIdGenerator,
} from "./notification-runtime.ts";
import type {
  NotificationService,
} from "./notification-service.ts";
import type {
  NotificationStore,
} from "./notification-store.ts";
import type {
  CreateNotificationRequest,
  Notification,
  NotificationQuery,
} from "./notification.ts";
import {
  normalizeNotificationId,
  normalizeNotificationQuery,
  normalizeNotificationRequest,
} from "./notification-validation.ts";

export interface DefaultNotificationServiceOptions {
  readonly clock?: NotificationClock;
  readonly idGenerator?: NotificationIdGenerator;
}

export class DefaultNotificationService
  implements NotificationService {
  readonly #clock: NotificationClock;
  readonly #idGenerator: NotificationIdGenerator;

  constructor(
    private readonly store: NotificationStore,
    options:
      DefaultNotificationServiceOptions = {},
  ) {
    this.#clock =
      options.clock ??
      new SystemNotificationClock();

    this.#idGenerator =
      options.idGenerator ??
      new UuidNotificationIdGenerator();
  }

  async create(
    request: CreateNotificationRequest,
  ): Promise<Notification> {
    const normalized =
      normalizeNotificationRequest(request);

    const createdAt = this.#clock.now();

    if (
      normalized.expiresAt !== undefined &&
      normalized.expiresAt.getTime() <=
        createdAt.getTime()
    ) {
      throw new RangeError(
        "Notification expiresAt must be later than createdAt.",
      );
    }

    const notificationId =
      normalizeNotificationId(
        this.#idGenerator.generate(),
      );
    const expiresAt =
      normalized.expiresAt === undefined
        ? undefined
        : new Date(
            normalized.expiresAt.getTime(),
          );

    const notification: Notification =
      Object.freeze({
        notificationId,
        notificationType:
          normalized.notificationType,
        recipient: normalized.recipient,
        title: normalized.title,
        message: normalized.message,
        severity: normalized.severity,
        channels: normalized.channels,
        actions: normalized.actions,
        createdAt: new Date(
          createdAt.getTime(),
        ),
        ...(normalized.data === undefined
          ? {}
          : { data: normalized.data }),
        ...(expiresAt === undefined
          ? {}
          : { expiresAt }),
        ...(normalized.correlationId ===
        undefined
          ? {}
          : {
              correlationId:
                normalized.correlationId,
            }),
        ...(normalized.sourceModule === undefined
          ? {}
          : {
              sourceModule:
                normalized.sourceModule,
            }),
      });

    await this.store.save(notification);

    return notification;
  }

  async get(
    notificationId: string,
  ): Promise<Notification | undefined> {
    return this.store.getById(
      normalizeNotificationId(notificationId),
    );
  }

  async require(
    notificationId: string,
  ): Promise<Notification> {
    const normalizedId =
      normalizeNotificationId(notificationId);

    const notification =
      await this.store.getById(normalizedId);

    if (notification === undefined) {
      throw new NotificationNotFoundError(
        normalizedId,
      );
    }

    return notification;
  }

  async list(
    query: NotificationQuery,
  ): Promise<readonly Notification[]> {
    return this.store.list(
      normalizeNotificationQuery(query),
      this.#clock.now(),
    );
  }

  async markAsRead(
    notificationId: string,
  ): Promise<Notification> {
    const normalizedId =
      normalizeNotificationId(notificationId);

    const notification =
      await this.store.markAsRead(
        normalizedId,
        this.#clock.now(),
      );

    if (notification === undefined) {
      throw new NotificationNotFoundError(
        normalizedId,
      );
    }

    return notification;
  }

  async markAllAsRead(
    query: NotificationQuery,
  ): Promise<number> {
    return this.store.markAllAsRead(
      normalizeNotificationQuery(query),
      this.#clock.now(),
    );
  }
}
