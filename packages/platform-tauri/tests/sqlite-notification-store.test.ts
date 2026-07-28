import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  DatabaseSync
} from "node:sqlite";
import {
  describe,
  it
} from "node:test";

import type {
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue
} from "@argin/database";

import {
  DuplicateNotificationError,
  type Notification
} from "@argin/platform";

import {
  SqliteNotificationStore
} from "../src/index.ts";

const migrationSql = readFileSync(
  new URL(
    "../../../apps/desktop/src-tauri/migrations/0008_notifications.sql",
    import.meta.url
  ),
  "utf8"
);

class TestSqliteExecutor
  implements DatabaseExecutor {
  constructor(
    private readonly database:
      DatabaseSync = new DatabaseSync(":memory:")
  ) {
    this.database.exec(migrationSql);
  }

  async execute(
    sql: string,
    parameters:
      readonly DatabaseValue[] = []
  ) {
    const result =
      this.database
        .prepare(sql)
        .run(...parameters);

    return {
      rowsAffected: Number(result.changes),
      ...(result.lastInsertRowid !== undefined
        ? {
            lastInsertId:
              Number(result.lastInsertRowid)
          }
        : {})
    };
  }

  async query<T>(
    sql: string,
    parameters:
      readonly DatabaseValue[] = []
  ): Promise<T[]> {
    return this.database
      .prepare(sql)
      .all(...parameters) as T[];
  }

  async queryOne<T>(
    sql: string,
    parameters:
      readonly DatabaseValue[] = []
  ): Promise<T | null> {
    return (
      this.database
        .prepare(sql)
        .get(...parameters) as T | undefined
    ) ?? null;
  }

  async transaction<T>(
    operation: (
      transaction: DatabaseSession
    ) => Promise<T>
  ): Promise<T> {
    return operation(this);
  }
}

const createdAt =
  new Date("2026-07-28T08:00:00.000Z");
const readAt =
  new Date("2026-07-28T09:00:00.000Z");

function createNotification(
  options: {
    notificationId?: string;
    recipientId?: string;
    createdAt?: Date;
    expiresAt?: Date;
  } = {}
): Notification {
  return Object.freeze({
    notificationId:
      options.notificationId ??
      "notification-1",
    notificationType: "system.message",
    recipient: Object.freeze({
      recipientType: "user" as const,
      recipientId:
        options.recipientId ?? "user-1"
    }),
    title: "Test notification",
    message: "Persistent message",
    severity: "information" as const,
    channels: Object.freeze([
      "in-app" as const
    ]),
    actions: Object.freeze([
      Object.freeze({
        actionId: "open",
        label: "Open",
        url: "/notifications/1"
      })
    ]),
    data: Object.freeze({
      invoiceId: "invoice-1"
    }),
    createdAt:
      options.createdAt ?? createdAt,
    ...(options.expiresAt !== undefined
      ? { expiresAt: options.expiresAt }
      : {}),
    correlationId: "correlation-1",
    sourceModule: "system"
  });
}

function createStore() {
  const database =
    new TestSqliteExecutor();

  return {
    database,
    store:
      new SqliteNotificationStore(database)
  };
}

describe(
  "SqliteNotificationStore",
  () => {
    it(
      "stores and restores the complete notification",
      async () => {
        const { store } = createStore();
        const notification =
          createNotification();

        await store.save(notification);

        const restored =
          await store.getById(
            notification.notificationId
          );

        assert.deepEqual(
          restored,
          notification
        );
      }
    );

    it(
      "persists across store instances",
      async () => {
        const { database, store } =
          createStore();

        await store.save(
          createNotification()
        );

        const replacement =
          new SqliteNotificationStore(
            database
          );

        assert.ok(
          await replacement.getById(
            "notification-1"
          )
        );
      }
    );

    it(
      "rejects duplicate identifiers",
      async () => {
        const { store } = createStore();
        const notification =
          createNotification();

        await store.save(notification);

        await assert.rejects(
          store.save(notification),
          DuplicateNotificationError
        );
      }
    );

    it(
      "lists recipient notifications newest first",
      async () => {
        const { store } = createStore();

        await store.save(
          createNotification({
            notificationId:
              "notification-1"
          })
        );
        await store.save(
          createNotification({
            notificationId:
              "notification-2",
            createdAt: new Date(
              "2026-07-28T10:00:00.000Z"
            )
          })
        );
        await store.save(
          createNotification({
            notificationId:
              "notification-3",
            recipientId: "user-2"
          })
        );

        const result = await store.list(
          {
            recipientType: "user",
            recipientId: "user-1"
          },
          readAt
        );

        assert.deepEqual(
          result.map(
            (notification) =>
              notification.notificationId
          ),
          [
            "notification-2",
            "notification-1"
          ]
        );
      }
    );

    it(
      "filters unread and expired notifications",
      async () => {
        const { store } = createStore();

        await store.save(
          createNotification({
            notificationId: "unread"
          })
        );
        await store.save(
          createNotification({
            notificationId: "read"
          })
        );
        await store.save(
          createNotification({
            notificationId: "expired",
            expiresAt: new Date(
              "2026-07-28T08:30:00.000Z"
            )
          })
        );
        await store.markAsRead(
          "read",
          readAt
        );

        const result = await store.list(
          {
            recipientType: "user",
            recipientId: "user-1",
            unreadOnly: true
          },
          readAt
        );

        assert.deepEqual(
          result.map(
            (notification) =>
              notification.notificationId
          ),
          ["unread"]
        );
      }
    );

    it(
      "marks one notification as read idempotently",
      async () => {
        const { store } = createStore();

        await store.save(
          createNotification()
        );

        const first =
          await store.markAsRead(
            "notification-1",
            readAt
          );
        const second =
          await store.markAsRead(
            "notification-1",
            new Date(
              "2026-07-28T10:00:00.000Z"
            )
          );

        assert.equal(
          first?.readAt?.toISOString(),
          readAt.toISOString()
        );
        assert.equal(
          second?.readAt?.toISOString(),
          readAt.toISOString()
        );
        assert.equal(
          await store.markAsRead(
            "missing",
            readAt
          ),
          undefined
        );
      }
    );

    it(
      "marks all unread recipient notifications as read",
      async () => {
        const { store } = createStore();

        await store.save(
          createNotification({
            notificationId:
              "notification-1"
          })
        );
        await store.save(
          createNotification({
            notificationId:
              "notification-2"
          })
        );
        await store.save(
          createNotification({
            notificationId:
              "notification-3",
            recipientId: "user-2"
          })
        );

        const count =
          await store.markAllAsRead(
            {
              recipientType: "user",
              recipientId: "user-1"
            },
            readAt
          );

        assert.equal(count, 2);
        assert.equal(
          (
            await store.getById(
              "notification-3"
            )
          )?.readAt,
          undefined
        );
      }
    );
  }
);
