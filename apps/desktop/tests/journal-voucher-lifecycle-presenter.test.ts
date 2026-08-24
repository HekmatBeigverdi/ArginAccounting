import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { JournalVoucherLifecycleDto } from "@argin/accounting/journal";
import { journalVoucherPermissions } from "@argin/accounting/journal";
import {
  journalVoucherLifecycleStatusLabel,
  presentJournalVoucherLifecycle,
} from "../src/features/accounting/journal-voucher-lifecycle-presenter.ts";

function lifecycle(
  status: JournalVoucherLifecycleDto["status"],
  actions: JournalVoucherLifecycleDto["capabilities"]["actions"],
): JournalVoucherLifecycleDto {
  return {
    voucherId: "voucher-1",
    companyId: "company-1",
    status,
    version: 4,
    capabilities: {
      editable: status === "draft",
      deletable: status === "draft",
      actions,
    },
    approval: null,
    posting: null,
    latestAmendment: null,
    reversal: null,
  };
}

describe("journal voucher lifecycle presenter", () => {
  it("presents all lifecycle states in Persian", () => {
    assert.equal(journalVoucherLifecycleStatusLabel("draft"), "پیش‌نویس");
    assert.equal(journalVoucherLifecycleStatusLabel("pending_approval"), "در انتظار تأیید");
    assert.equal(journalVoucherLifecycleStatusLabel("approved"), "تأییدشده");
    assert.equal(journalVoucherLifecycleStatusLabel("posted"), "ثبت نهایی");
    assert.equal(journalVoucherLifecycleStatusLabel("reversed"), "برگشت‌شده");
  });

  it("intersects Application capabilities with granted permissions", () => {
    const view = presentJournalVoucherLifecycle(
      lifecycle("approved", ["reopen_for_amendment", "post"]),
      new Set([journalVoucherPermissions.post]),
    );

    assert.deepEqual(view.actions.map((action) => action.action), ["post"]);
    assert.equal(view.locked, true);
    assert.equal(view.statusLabel, "تأییدشده");
  });

  it("full access preserves all state-policy actions", () => {
    const view = presentJournalVoucherLifecycle(
      lifecycle("pending_approval", ["approve", "reject", "return_to_draft", "cancel_approval"]),
      new Set(["system.full-access"]),
    );

    assert.equal(view.actions.length, 4);
    assert.ok(view.actions.every((action) => action.confirmation !== null));
  });

  it("terminal reversed state exposes no next action", () => {
    const view = presentJournalVoucherLifecycle(
      lifecycle("reversed", []),
      new Set(["system.full-access"]),
    );

    assert.equal(view.actions.length, 0);
    assert.equal(view.locked, true);
  });
});
