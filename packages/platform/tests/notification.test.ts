import assert from "node:assert/strict";
import test from "node:test";

import {
  DefaultNotificationService,
  DuplicateNotificationError,
  InMemoryNotificationStore,
  NotificationNotFoundError,
  type NotificationClock,
  type NotificationIdGenerator,
} from "../src/index.ts";

class FixedClock implements NotificationClock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(value: Date): void {
    this.current = value;
  }
}

class SequentialIdGenerator
  implements NotificationIdGenerator {
  #sequence = 0;

  generate(): string {
    this.#sequence += 1;
    return `notification-${this.#sequence}`;
  }
}

function createFixture() {
  const clock = new FixedClock(
    new Date("2026-07-26T08:00:00.000Z"),
  );

  const store =
    new InMemoryNotificationStore();

  const service =
    new DefaultNotificationService(store, {
      clock,
      idGenerator:
        new SequentialIdGenerator(),
    });

  return {
    clock,
    store,
    service,
  };
}

test("notification service creates an in-app notification", async () => {
  const { service, store } = createFixture();

  const notification = await service.create({
    notificationType: "approval.requested",
    sourceModule: "approval",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "درخواست تأیید جدید",
    message:
      "یک سند حسابداری برای تأیید شما ارسال شده است.",
  });

  assert.equal(
    notification.notificationId,
    "notification-1",
  );

  assert.equal(
    notification.notificationType,
    "approval.requested",
  );

  assert.equal(
    notification.severity,
    "information",
  );

  assert.deepEqual(
    notification.channels,
    ["in-app"],
  );

  assert.equal(
    notification.createdAt.toISOString(),
    "2026-07-26T08:00:00.000Z",
  );

  assert.equal(store.notificationCount, 1);
});

test("notification supports severity, channels, data, and actions", async () => {
  const { service } = createFixture();

  const notification = await service.create({
    notificationType:
      "taxpayer.invoice-rejected",
    sourceModule: "taxpayer",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "رد صورتحساب",
    message:
      "صورتحساب توسط سامانه مودیان رد شد.",
    severity: "error",
    channels: ["in-app", "email"],
    correlationId: "invoice-100",
    data: {
      invoiceId: "invoice-100",
      errorCode: "0304401",
    },
    actions: [
      {
        actionId: "view-invoice",
        label: "مشاهده صورتحساب",
        url: "/sales/invoices/invoice-100",
      },
      {
        actionId: "retry-submission",
        label: "ارسال مجدد",
        commandName:
          "taxpayer.retry-invoice-submission",
        parameters: {
          invoiceId: "invoice-100",
        },
      },
    ],
  });

  assert.equal(
    notification.severity,
    "error",
  );

  assert.deepEqual(
    notification.channels,
    ["in-app", "email"],
  );

  assert.equal(
    notification.actions.length,
    2,
  );

  assert.equal(
    notification.data?.errorCode,
    "0304401",
  );
});

test("notifications can be retrieved by id", async () => {
  const { service } = createFixture();

  const created = await service.create({
    notificationType:
      "inventory.low-stock",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "هشدار موجودی",
    message: "موجودی کالا کمتر از حداقل است.",
  });

  const retrieved = await service.get(
    created.notificationId,
  );

  assert.equal(
    retrieved?.notificationId,
    created.notificationId,
  );
});

test("require reports a missing notification", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.require("missing-notification"),
    (error: unknown) =>
      error instanceof NotificationNotFoundError &&
      error.code === "notification.not-found" &&
      error.notificationId ===
        "missing-notification",
  );
});

test("notifications are listed for the correct recipient", async () => {
  const { service } = createFixture();

  await service.create({
    notificationType: "approval.requested",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "اعلان اول",
    message: "متن اعلان اول",
  });

  await service.create({
    notificationType: "approval.requested",
    recipient: {
      recipientType: "user",
      recipientId: "user-2",
    },
    title: "اعلان دوم",
    message: "متن اعلان دوم",
  });

  const notifications = await service.list({
    recipientType: "user",
    recipientId: "user-1",
  });

  assert.equal(notifications.length, 1);
  assert.equal(
    notifications[0]?.recipient.recipientId,
    "user-1",
  );
});

test("notifications are sorted from newest to oldest", async () => {
  const { service, clock } = createFixture();

  await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "اعلان قدیمی",
    message: "متن اعلان قدیمی",
  });

  clock.set(
    new Date("2026-07-26T09:00:00.000Z"),
  );

  await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "اعلان جدید",
    message: "متن اعلان جدید",
  });

  const notifications = await service.list({
    recipientType: "user",
    recipientId: "user-1",
  });

  assert.deepEqual(
    notifications.map(
      (notification) => notification.title,
    ),
    ["اعلان جدید", "اعلان قدیمی"],
  );
});

test("notification can be marked as read", async () => {
  const { service, clock } = createFixture();

  const created = await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "پیام سیستم",
    message: "متن پیام سیستم",
  });

  clock.set(
    new Date("2026-07-26T10:00:00.000Z"),
  );

  const updated = await service.markAsRead(
    created.notificationId,
  );

  assert.equal(
    updated.readAt?.toISOString(),
    "2026-07-26T10:00:00.000Z",
  );
});

test("mark as read is idempotent", async () => {
  const { service, clock } = createFixture();

  const created = await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "پیام",
    message: "متن پیام",
  });

  const first = await service.markAsRead(
    created.notificationId,
  );

  clock.set(
    new Date("2026-07-27T10:00:00.000Z"),
  );

  const second = await service.markAsRead(
    created.notificationId,
  );

  assert.equal(
    first.readAt?.toISOString(),
    second.readAt?.toISOString(),
  );
});

test("unread query excludes read notifications", async () => {
  const { service } = createFixture();

  const first = await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "خوانده‌شده",
    message: "متن اول",
  });

  await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "خوانده‌نشده",
    message: "متن دوم",
  });

  await service.markAsRead(
    first.notificationId,
  );

  const unread = await service.list({
    recipientType: "user",
    recipientId: "user-1",
    unreadOnly: true,
  });

  assert.equal(unread.length, 1);
  assert.equal(
    unread[0]?.title,
    "خوانده‌نشده",
  );
});

test("all recipient notifications can be marked as read", async () => {
  const { service } = createFixture();

  for (let index = 1; index <= 3; index += 1) {
    await service.create({
      notificationType: "system.message",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: `اعلان ${index}`,
      message: `متن اعلان ${index}`,
    });
  }

  const count = await service.markAllAsRead({
    recipientType: "user",
    recipientId: "user-1",
  });

  assert.equal(count, 3);

  const unread = await service.list({
    recipientType: "user",
    recipientId: "user-1",
    unreadOnly: true,
  });

  assert.deepEqual(unread, []);
});

test("expired notifications are excluded by default", async () => {
  const { service, clock } = createFixture();

  await service.create({
    notificationType: "system.temporary-message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "اعلان موقت",
    message: "این اعلان منقضی خواهد شد.",
    expiresAt: new Date(
      "2026-07-26T09:00:00.000Z",
    ),
  });

  clock.set(
    new Date("2026-07-26T10:00:00.000Z"),
  );

  const active = await service.list({
    recipientType: "user",
    recipientId: "user-1",
  });

  const includingExpired = await service.list({
    recipientType: "user",
    recipientId: "user-1",
    includeExpired: true,
  });

  assert.equal(active.length, 0);
  assert.equal(includingExpired.length, 1);
});

test("expiration must be later than creation", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.create({
      notificationType: "system.message",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: "پیام",
      message: "متن پیام",
      expiresAt: new Date(
        "2026-07-26T07:00:00.000Z",
      ),
    }),
    RangeError,
  );
});

test("notification types require module-prefixed notation", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.create({
      notificationType: "Message",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: "پیام",
      message: "متن پیام",
    }),
    TypeError,
  );

  await assert.rejects(
    service.create({
      notificationType: "message",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: "پیام",
      message: "متن پیام",
    }),
    TypeError,
  );
});

test("source module must match notification type", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.create({
      notificationType: "inventory.low-stock",
      sourceModule: "sales",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: "هشدار",
      message: "متن هشدار",
    }),
    TypeError,
  );
});

test("duplicate channels are removed", async () => {
  const { service } = createFixture();

  const notification = await service.create({
    notificationType: "system.message",
    recipient: {
      recipientType: "user",
      recipientId: "user-1",
    },
    title: "پیام",
    message: "متن پیام",
    channels: [
      "in-app",
      "email",
      "in-app",
    ],
  });

  assert.deepEqual(
    notification.channels,
    ["in-app", "email"],
  );
});

test("actions require a URL or command name", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.create({
      notificationType: "system.message",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: "پیام",
      message: "متن پیام",
      actions: [
        {
          actionId: "open",
          label: "مشاهده",
        },
      ],
    }),
    TypeError,
  );
});

test("duplicate action identifiers are rejected", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.create({
      notificationType: "system.message",
      recipient: {
        recipientType: "user",
        recipientId: "user-1",
      },
      title: "پیام",
      message: "متن پیام",
      actions: [
        {
          actionId: "view",
          label: "مشاهده",
          url: "/notifications/1",
        },
        {
          actionId: "view",
          label: "مشاهده مجدد",
          url: "/notifications/1",
        },
      ],
    }),
    TypeError,
  );
});

test("query limits are validated", async () => {
  const { service } = createFixture();

  await assert.rejects(
    service.list({
      recipientType: "user",
      recipientId: "user-1",
      limit: 0,
    }),
    RangeError,
  );

  await assert.rejects(
    service.list({
      recipientType: "user",
      recipientId: "user-1",
      limit: 1_001,
    }),
    RangeError,
  );
});

test("store rejects duplicate notification identifiers", async () => {
  const store =
    new InMemoryNotificationStore();

  const notification = Object.freeze({
    notificationId: "notification-1",
    notificationType: "system.message",
    recipient: Object.freeze({
      recipientType: "user" as const,
      recipientId: "user-1",
    }),
    title: "پیام",
    message: "متن پیام",
    severity: "information" as const,
    channels: Object.freeze([
      "in-app" as const,
    ]),
    actions: Object.freeze([]),
    createdAt: new Date(
      "2026-07-26T08:00:00.000Z",
    ),
  });

  await store.save(notification);

  await assert.rejects(
    store.save(notification),
    (error: unknown) =>
      error instanceof DuplicateNotificationError &&
      error.code === "notification.duplicate",
  );
});
