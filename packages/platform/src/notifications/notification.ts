export type NotificationSeverity =
  | "information"
  | "success"
  | "warning"
  | "error";

export type NotificationRecipientType =
  | "user"
  | "role"
  | "branch"
  | "company"
  | "system";

export type NotificationChannel =
  | "in-app"
  | "email"
  | "sms"
  | "push";

export interface NotificationRecipient {
  readonly recipientType: NotificationRecipientType;
  readonly recipientId: string;
}

export interface NotificationAction {
  readonly actionId: string;
  readonly label: string;
  readonly url?: string;
  readonly commandName?: string;
  readonly parameters?: Readonly<
    Record<string, unknown>
  >;
}

export interface Notification {
  readonly notificationId: string;
  readonly notificationType: string;
  readonly recipient: NotificationRecipient;
  readonly title: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly channels: readonly NotificationChannel[];
  readonly actions: readonly NotificationAction[];
  readonly data?: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly readAt?: Date;
  readonly expiresAt?: Date;
  readonly correlationId?: string;
  readonly sourceModule?: string;
}

export interface CreateNotificationRequest {
  readonly notificationType: string;
  readonly recipient: NotificationRecipient;
  readonly title: string;
  readonly message: string;
  readonly severity?: NotificationSeverity;
  readonly channels?: readonly NotificationChannel[];
  readonly actions?: readonly NotificationAction[];
  readonly data?: Readonly<Record<string, unknown>>;
  readonly expiresAt?: Date;
  readonly correlationId?: string;
  readonly sourceModule?: string;
}

export interface NotificationQuery {
  readonly recipientType: NotificationRecipientType;
  readonly recipientId: string;
  readonly unreadOnly?: boolean;
  readonly includeExpired?: boolean;
  readonly limit?: number;
}
