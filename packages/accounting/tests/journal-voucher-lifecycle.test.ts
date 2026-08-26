import assert from "node:assert/strict";
import test from "node:test";

import {
  createJournalVoucher,
  type JournalVoucher,
} from "../src/domain/journal-voucher.ts";
import {
  canTransitionJournalVoucher,
  getAllowedJournalVoucherLifecycleActions,
  JournalVoucherLifecycleError,
  transitionJournalVoucher,
  type JournalVoucherLifecycleAction,
} from "../src/domain/journal-voucher-lifecycle.ts";

function draftVoucher(): JournalVoucher {
  return createJournalVoucher({
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "JV-000001",
    voucherDate: "2026-08-23",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-06",
    currency: "IRR",
    lines: [
      {
        id: "line-1",
        order: 1,
        accountId: "account-debit",
        debit: 1_000_000,
        credit: 0,
      },
      {
        id: "line-2",
        order: 2,
        accountId: "account-credit",
        debit: 0,
        credit: 1_000_000,
      },
    ],
    createdAt: "2026-08-23T05:30:00.000Z",
  });
}

function apply(
  voucher: JournalVoucher,
  action: JournalVoucherLifecycleAction,
  minute: number,
): JournalVoucher {
  return transitionJournalVoucher(voucher, {
    action,
    actorId: "user-1",
    occurredAt: `2026-08-23T05:${String(minute).padStart(2, "0")}:00.000Z`,
  }).voucher;
}

test("follows the accepted happy-path lifecycle and makes reversed terminal", () => {
  let voucher = draftVoucher();

  voucher = apply(voucher, "submit_for_approval", 31);
  assert.equal(voucher.status, "pending_approval");

  voucher = apply(voucher, "approval_approved", 32);
  assert.equal(voucher.status, "approved");

  voucher = apply(voucher, "post", 33);
  assert.equal(voucher.status, "posted");

  voucher = apply(voucher, "reverse", 34);
  assert.equal(voucher.status, "reversed");
  assert.deepEqual(getAllowedJournalVoucherLifecycleActions(voucher.status), []);
});

test("returns pending approval to draft for return, rejection and cancellation", () => {
  for (const action of [
    "approval_returned",
    "approval_rejected",
    "approval_cancelled",
  ] as const) {
    const pending = apply(draftVoucher(), "submit_for_approval", 31);
    const result = transitionJournalVoucher(pending, {
      action,
      actorId: "approver-1",
      occurredAt: "2026-08-23T05:32:00.000Z",
    });

    assert.equal(result.voucher.status, "draft");
    assert.equal(result.evidence.previousStatus, "pending_approval");
    assert.equal(result.evidence.newStatus, "draft");
  }
});

test("reopens an approved unposted voucher only through controlled amendment", () => {
  const pending = apply(draftVoucher(), "submit_for_approval", 31);
  const approved = apply(pending, "approval_approved", 32);
  const reopened = transitionJournalVoucher(approved, {
    action: "reopen_for_amendment",
    actorId: "editor-1",
    occurredAt: "2026-08-23T05:33:00.000Z",
  });

  assert.equal(reopened.voucher.status, "draft");
  assert.equal(reopened.evidence.action, "reopen_for_amendment");
});

test("rejects illegal transitions independently from UI state", () => {
  const invalid: readonly [JournalVoucher, JournalVoucherLifecycleAction][] = [
    [draftVoucher(), "post"],
    [draftVoucher(), "reverse"],
    [apply(draftVoucher(), "submit_for_approval", 31), "post"],
  ];

  for (const [voucher, action] of invalid) {
    assert.equal(canTransitionJournalVoucher(voucher.status, action), false);
    assert.throws(
      () => transitionJournalVoucher(voucher, {
        action,
        actorId: "user-1",
        occurredAt: "2026-08-23T05:40:00.000Z",
      }),
      (error: unknown) =>
        error instanceof JournalVoucherLifecycleError &&
        error.code === "invalid_transition",
    );
  }
});

test("increments optimistic version and records immutable actor/time transition evidence", () => {
  const voucher = draftVoucher();
  const result = transitionJournalVoucher(voucher, {
    action: "submit_for_approval",
    actorId: "  user-42  ",
    occurredAt: "2026-08-23T09:01:02+03:30",
  });

  assert.equal(result.voucher.version, voucher.version + 1);
  assert.equal(result.evidence.previousVersion, voucher.version);
  assert.equal(result.evidence.newVersion, voucher.version + 1);
  assert.equal(result.evidence.actorId, "user-42");
  assert.equal(result.evidence.occurredAt, "2026-08-23T05:31:02.000Z");
  assert.equal(result.voucher.updatedAt, result.evidence.occurredAt);
  assert.ok(Object.isFrozen(result.voucher));
  assert.ok(Object.isFrozen(result.evidence));
  assert.equal(voucher.status, "draft");
});

test("requires actor and valid timestamp evidence for every legal transition", () => {
  assert.throws(
    () => transitionJournalVoucher(draftVoucher(), {
      action: "submit_for_approval",
      actorId: "   ",
      occurredAt: "2026-08-23T05:31:00.000Z",
    }),
    (error: unknown) =>
      error instanceof JournalVoucherLifecycleError &&
      error.code === "actor_required",
  );

  assert.throws(
    () => transitionJournalVoucher(draftVoucher(), {
      action: "submit_for_approval",
      actorId: "user-1",
      occurredAt: "not-a-timestamp",
    }),
    (error: unknown) =>
      error instanceof JournalVoucherLifecycleError &&
      error.code === "occurred_at_invalid",
  );
});
