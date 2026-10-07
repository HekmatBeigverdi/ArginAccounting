import assert from "node:assert/strict";
import test from "node:test";

import {
  createSalesPostingRecoveryViewModel,
} from "../src/features/sales/sales-posting-recovery-view";

test("maps pending valuation state to Persian wait guidance", () => {
  const view = createSalesPostingRecoveryViewModel({
    status: "pending",
    retryAction: "wait",
    reason: "waiting-for-valuation",
    waitingLineIds: ["line-1"],
    journalVoucherId: null,
    committedPostingVersion: null,
  });

  assert.equal(view.statusLabel, "در انتظار تکمیل پیش‌نیازها");
  assert.equal(view.actionLabel, null);
  assert.match(view.reasonLabel ?? "", /بهای تمام‌شده/u);
  assert.deepEqual(view.waitingLineIds, ["line-1"]);
});

test("maps retriable ready state to retry action", () => {
  const view = createSalesPostingRecoveryViewModel({
    status: "ready",
    retryAction: "retry",
    reason: "sales_posting.concurrency_conflict",
    waitingLineIds: [],
    journalVoucherId: null,
    committedPostingVersion: null,
  });

  assert.equal(view.statusLabel, "آماده ثبت حسابداری");
  assert.equal(view.actionLabel, "تلاش مجدد");
  assert.match(view.reasonLabel ?? "", /هم‌زمان/u);
});

test("maps committed outcome to replay with Journal identity", () => {
  const view = createSalesPostingRecoveryViewModel({
    status: "committed",
    retryAction: "replay",
    reason: null,
    waitingLineIds: [],
    journalVoucherId: "journal-001",
    committedPostingVersion: 3,
  });

  assert.equal(view.statusLabel, "ثبت حسابداری ایجاد شده");
  assert.equal(view.actionLabel, "بازخوانی نتیجه ثبت‌شده");
  assert.equal(view.journalVoucherId, "journal-001");
  assert.equal(view.committedPostingVersion, 3);
});

test("maps structural failure to manual review instead of blind retry", () => {
  const view = createSalesPostingRecoveryViewModel({
    status: "blocked",
    retryAction: "manual-review",
    reason: "sales_posting.account_mapping_missing",
    waitingLineIds: [],
    journalVoucherId: null,
    committedPostingVersion: null,
  });

  assert.equal(view.statusLabel, "نیازمند بررسی");
  assert.equal(view.actionLabel, "بررسی دستی");
  assert.match(view.reasonLabel ?? "", /اتصال/u);
});
