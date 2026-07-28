import type {
  DatabaseExecutor
} from "@argin/database";

import {
  DuplicateNotificationError,
  normalizeNotificationId,
  normalizeNotificationQuery,
  type Notification,
  type NotificationAction,
  type NotificationChannel,
  type NotificationQuery,
  type NotificationRecipientType,
  type NotificationSeverity,
  type NotificationStore
} from "@argin/platform";

interface NotificationRow {
  notification_id: string;
  notification_type: string;
  recipient_type: string;
  recipient_id: string;
  title: string;
  message: string;
  severity: string;
  channels_json: string;
  actions_json: string;
  data_json: string | null;
  created_at: string;
  read_at: string | null;
  expires_at: string | null;
  correlation_id: string | null;
  source_module: string | null;
}

const SELECT_NOTIFICATION = `
  SELECT
      notification_id,
      notification_type,
      recipient_type,
      recipient_id,
      title,
      message,
      severity,
      channels_json,
      actions_json,
      data_json,
      created_at,
      read_at,
      expires_at,
      correlation_id,
      source_module
  FROM notifications
`;

function parseJson<T>(
  value: string,
  fieldName: string
): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new TypeError(
      `Stored notification ${fieldName} is not valid JSON.`
    );
  }
}

function serializeJson(
  value: unknown,
  fieldName: string
): string {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError(
      `Notification ${fieldName} must be JSON serializable.`
    );
  }

  if (serialized === undefined) {
    throw new TypeError(
      `Notification ${fieldName} must be JSON serializable.`
    );
  }

  return serialized;
}

function mapNotification(
  row: NotificationRow
): Notification {
  return Object.freeze({
    notificationId: row.notification_id,
    notificationType: row.notification_type,
    recipient: Object.freeze({
      recipientType:
        row.recipient_type as NotificationRecipientType,
      recipientId: row.recipient_id
    }),
    title: row.title,
    message: row.message,
    severity:
      row.severity as NotificationSeverity,
    channels: Object.freeze(
      parseJson<NotificationChannel[]>(
        row.channels_json,
        "channels"
      )
    ),
    actions: Object.freeze(
      parseJson<NotificationAction[]>(
        row.actions_json,
        "actions"
      )
    ),
    ...(row.data_json !== null
      ? {
          data: Object.freeze(
            parseJson<Record<string, unknown>>(
              row.data_json,
              "data"
            )
          )
        }
      : {}),
    createdAt: new Date(row.created_at),
    ...(row.read_at !== null
      ? { readAt: new Date(row.read_at) }
      : {}),
    ...(row.expires_at !== null
      ? { expiresAt: new Date(row.expires_at) }
      : {}),
    ...(row.correlation_id !== null
      ? { correlationId: row.correlation_id }
      : {}),
    ...(row.source_module !== null
      ? { sourceModule: row.source_module }
      : {})
  });
}

export class SqliteNotificationStore
  implements NotificationStore {
  constructor(
    private readonly database:
      DatabaseExecutor
  ) {}

  async save(
    notification: Notification
  ): Promise<void> {
    const channelsJson = serializeJson(
      notification.channels,
      "channels"
    );
    const actionsJson = serializeJson(
      notification.actions,
      "actions"
    );
    const dataJson =
      notification.data === undefined
        ? null
        : serializeJson(
            notification.data,
            "data"
          );

    try {
      await this.database.execute(
        `
        INSERT INTO notifications
        (
            notification_id,
            notification_type,
            recipient_type,
            recipient_id,
            title,
            message,
            severity,
            channels_json,
            actions_json,
            data_json,
            created_at,
            read_at,
            expires_at,
            correlation_id,
            source_module
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          notification.notificationId,
          notification.notificationType,
          notification.recipient.recipientType,
          notification.recipient.recipientId,
          notification.title,
          notification.message,
          notification.severity,
          channelsJson,
          actionsJson,
          dataJson,
          notification.createdAt.toISOString(),
          notification.readAt?.toISOString() ?? null,
          notification.expiresAt?.toISOString() ?? null,
          notification.correlationId ?? null,
          notification.sourceModule ?? null
        ]
      );
    } catch (error) {
      const existing =
        await this.getById(
          notification.notificationId
        );

      if (existing !== undefined) {
        throw new DuplicateNotificationError(
          notification.notificationId
        );
      }

      throw error;
    }
  }

  async getById(
    notificationId: string
  ): Promise<Notification | undefined> {
    const normalizedId =
      normalizeNotificationId(notificationId);
    const row =
      await this.database.queryOne<NotificationRow>(
        `
        ${SELECT_NOTIFICATION}
        WHERE notification_id = ?
        LIMIT 1
        `,
        [normalizedId]
      );

    return row === null
      ? undefined
      : mapNotification(row);
  }

  async list(
    query: NotificationQuery,
    now: Date
  ): Promise<readonly Notification[]> {
    const normalized =
      normalizeNotificationQuery(query);
    const conditions = [
      "recipient_type = ?",
      "recipient_id = ?"
    ];
    const parameters: (
      | string
      | number
      | null
    )[] = [
      normalized.recipientType,
      normalized.recipientId
    ];

    if (normalized.unreadOnly === true) {
      conditions.push("read_at IS NULL");
    }

    if (normalized.includeExpired !== true) {
      conditions.push(
        "(expires_at IS NULL OR expires_at > ?)"
      );
      parameters.push(now.toISOString());
    }

    parameters.push(normalized.limit ?? 100);

    const rows =
      await this.database.query<NotificationRow>(
        `
        ${SELECT_NOTIFICATION}
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ?
        `,
        parameters
      );

    return rows.map(mapNotification);
  }

  async markAsRead(
    notificationId: string,
    readAt: Date
  ): Promise<Notification | undefined> {
    const normalizedId =
      normalizeNotificationId(notificationId);

    await this.database.execute(
      `
      UPDATE notifications
      SET read_at = ?
      WHERE notification_id = ?
        AND read_at IS NULL
      `,
      [
        readAt.toISOString(),
        normalizedId
      ]
    );

    return this.getById(normalizedId);
  }

  async markAllAsRead(
    query: NotificationQuery,
    readAt: Date
  ): Promise<number> {
    const normalized =
      normalizeNotificationQuery(query);
    const result =
      await this.database.execute(
        `
        UPDATE notifications
        SET read_at = ?
        WHERE recipient_type = ?
          AND recipient_id = ?
          AND read_at IS NULL
        `,
        [
          readAt.toISOString(),
          normalized.recipientType,
          normalized.recipientId
        ]
      );

    return result.rowsAffected;
  }
}
