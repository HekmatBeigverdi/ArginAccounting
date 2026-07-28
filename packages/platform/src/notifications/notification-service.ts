import type {
  CreateNotificationRequest,
  Notification,
  NotificationQuery,
} from "./notification.ts";

export interface NotificationService {
  create(
    request: CreateNotificationRequest,
  ): Promise<Notification>;

  get(
    notificationId: string,
  ): Promise<Notification | undefined>;

  require(
    notificationId: string,
  ): Promise<Notification>;

  list(
    query: NotificationQuery,
  ): Promise<readonly Notification[]>;

  markAsRead(
    notificationId: string,
  ): Promise<Notification>;

  markAllAsRead(
    query: NotificationQuery,
  ): Promise<number>;
}
