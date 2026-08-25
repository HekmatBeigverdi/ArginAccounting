import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DefaultNotificationService,
  InMemoryNotificationStore,
} from "@argin/platform";

import type { JournalVoucher } from "../src/domain/journal-voucher.ts";
import {
  emitJournalVoucherAuthorizationDenied,
  emitJournalVoucherLifecycleSuccess,
  type JournalVoucherLifecycleAuditEvidence,
  type JournalVoucherLifecycleEffects,
} from "../src/application/journal-voucher-lifecycle-effects.ts";

function voucher(status: JournalVoucher["status"], version: number): JournalVoucher {
  return {
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "000001",
    reference: null,
    voucherDate: "2026-08-24",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "period-1",
    description: null,
    status,
    currency: "IRR",
    source: { type: "manual", sourceId: null, requestId: null, correlationId: null, causationId: null },
    lines: [],
    totalDebit: { amount: 0, currency: "IRR" },
    totalCredit: { amount: 0, currency: "IRR" },
    createdAt: "2026-08-24T09:00:00.000Z",
    updatedAt: "2026-08-24T10:00:00.000Z",
    version,
  } as unknown as JournalVoucher;
}

function harness() {
  const order: string[] = [];
  const audits: JournalVoucherLifecycleAuditEvidence[] = [];
  const events: Array<{ eventType: string; eventId: string }> = [];
  const notifications: Array<{ notificationType: string; recipientId: string }> = [];

  const effects: JournalVoucherLifecycleEffects = {
    audit: {
      async record(evidence) {
        order.push("audit");
        audits.push(evidence);
      },
    },
    events: {
      async publish(event) {
        order.push("event");
        events.push({ eventType: event.eventType, eventId: event.eventId });
      },
    },
    notifications: {
      async create(request) {
        order.push("notification");
        notifications.push({ notificationType: request.notificationType, recipientId: request.recipient.recipientId });
        return {} as never;
      },
      async get() { return undefined; },
      async require() { return {} as never; },
      async list() { return []; },
      async markAsRead() { return {} as never; },
      async markAllAsRead() { return 0; },
    },
  };

  return { effects, order, audits, events, notifications };
}

describe("journal voucher lifecycle effects", () => {
  it("persists audit before publishing the post-commit integration event", async () => {
    const h = harness();
    await emitJournalVoucherLifecycleSuccess(h.effects, {
      action: "post",
      context: {
        actorId: "user-1",
        companyId: "company-1",
        requestId: "request-1",
        correlationId: "corr-1",
        causationId: "cause-1",
        occurredAt: "2026-08-24T10:00:00.000Z",
      },
      voucher: voucher("posted", 5),
      previousStatus: "approved",
      previousVersion: 4,
      approvalRequestId: "approval-1",
      postingReference: "POST-1",
    });

    assert.deepEqual(h.order, ["audit", "event"]);
    assert.equal(h.audits[0]?.newStatus, "posted");
    assert.equal(h.events[0]?.eventType, "accounting.journal-voucher.post");
    assert.match(h.events[0]?.eventId ?? "", /voucher-1:5:post/u);
  });

  it("notifies the approval requester only for operational approval outcomes", async () => {
    const h = harness();
    await emitJournalVoucherLifecycleSuccess(h.effects, {
      action: "reject",
      context: {
        actorId: "approver-1",
        companyId: "company-1",
        requestId: null,
        correlationId: "corr-2",
        causationId: null,
        occurredAt: "2026-08-24T10:05:00.000Z",
      },
      voucher: voucher("draft", 4),
      previousStatus: "pending_approval",
      previousVersion: 3,
      approvalRequestId: "approval-1",
      approvalRequesterId: "requester-1",
      reason: "Needs correction",
    });

    assert.deepEqual(h.order, ["audit", "event", "notification"]);
    assert.deepEqual(h.notifications, [{
      notificationType: "accounting.journal-voucher.rejected",
      recipientId: "requester-1",
    }]);
  });

  it("uses notification types accepted by the real platform notification service", async () => {
    const store = new InMemoryNotificationStore();
    const notifications = new DefaultNotificationService(store, {
      clock: { now: () => new Date("2026-08-24T10:05:00.000Z") },
      idGenerator: { generate: () => "notification-1" },
    });
    const effects: JournalVoucherLifecycleEffects = {
      audit: { async record() {} },
      events: { async publish() {} },
      notifications,
    };

    await emitJournalVoucherLifecycleSuccess(effects, {
      action: "approve",
      context: {
        actorId: "approver-1",
        companyId: "company-1",
        requestId: "request-approve-1",
        correlationId: "corr-approve-1",
        causationId: null,
        occurredAt: "2026-08-24T10:05:00.000Z",
      },
      voucher: voucher("approved", 4),
      previousStatus: "pending_approval",
      previousVersion: 3,
      approvalRequestId: "approval-1",
      approvalRequesterId: "requester-1",
    });

    const saved = await notifications.list({
      recipientType: "user",
      recipientId: "requester-1",
    });
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.notificationType, "accounting.journal-voucher.approved");
    assert.equal(saved[0]?.sourceModule, "accounting");
  });

  it("records authorization denial without publishing an integration event", async () => {
    const h = harness();
    await emitJournalVoucherAuthorizationDenied(h.effects, {
      action: "post",
      voucherId: "voucher-1",
      companyId: "company-1",
      actorId: "user-2",
      occurredAt: "2026-08-24T10:10:00.000Z",
      correlationId: "corr-3",
      reason: "permission missing",
    });

    assert.deepEqual(h.order, ["audit"]);
    assert.equal(h.audits[0]?.outcome, "denied");
    assert.match(h.audits[0]?.reason ?? "", /post/u);
    assert.equal(h.events.length, 0);
  });
});
