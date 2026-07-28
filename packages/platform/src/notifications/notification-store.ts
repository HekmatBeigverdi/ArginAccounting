import type {
  Notification,
  NotificationQuery,
} from "./notification.ts";

export interface NotificationStore {
  save(notification: Notification): Promise<void>;

  getById(
    notificationId: string,
  ): Promise<Notification | undefined>;

  list(
    query: NotificationQuery,
    now: Date,
  ): Promise<readonly Notification[]>;

  markAsRead(
    notificationId: string,
    readAt: Date,
  ): Promise<Notification | undefined>;

  markAllAsRead(
    query: NotificationQuery,
    readAt: Date,
  ): Promise<number>;
}
