import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  journalVoucherPermissions,
  type JournalVoucherLifecycleDto,
} from "@argin/accounting/journal";
import { defaultPermissions } from "@argin/security";
import {
  presentJournalVoucherLifecycle,
  presentJournalVoucherLifecycleFailure,
} from "../src/features/accounting/journal-voucher-lifecycle-presenter.ts";

const overviewSource = readFileSync(
  new URL("../src/pages/accounting/journal-voucher-lifecycle-overview.tsx", import.meta.url),
  "utf8",
);
const journalPageSource = readFileSync(
  new URL("../src/pages/accounting/journal-vouchers-page.tsx", import.meta.url),
  "utf8",
);
const approvalDetailsSource = readFileSync(
  new URL("../src/pages/approval/approval-request-details-page.tsx", import.meta.url),
  "utf8",
);
const compositionSource = readFileSync(
  new URL("../src/composition/accounting/create-journal-lifecycle-services.ts", import.meta.url),
  "utf8",
);

const lifecyclePermissions = [
  journalVoucherPermissions.submit,
  journalVoucherPermissions.approve,
  journalVoucherPermissions.reject,
  journalVoucherPermissions.returnToDraft,
  journalVoucherPermissions.cancelApproval,
  journalVoucherPermissions.post,
  journalVoucherPermissions.reopenForAmendment,
  journalVoucherPermissions.reverse,
] as const;

function approvedLifecycle(): JournalVoucherLifecycleDto {
  return {
    voucherId: "voucher-1",
    companyId: "company-1",
    status: "approved",
    version: 4,
    capabilities: {
      editable: false,
      deletable: false,
      actions: ["reopen_for_amendment", "post"],
    },
    approval: {
      approvalRequestId: "approval-1",
      submittedContentVersion: 2,
      status: "approved",
      isCurrent: true,
    },
    posting: null,
    latestAmendment: null,
    reversal: null,
  };
}

describe("journal lifecycle desktop regression", () => {
  it("keeps every lifecycle permission registered in the default security catalog", () => {
    const registered = new Set(defaultPermissions.map((permission) => permission.code));
    for (const permission of lifecyclePermissions) {
      assert.equal(registered.has(permission), true, `missing ${permission}`);
    }
    assert.equal(new Set(lifecyclePermissions).size, lifecyclePermissions.length);
  });

  it("does not expose posting when the user lacks the posting permission", () => {
    const view = presentJournalVoucherLifecycle(
      approvedLifecycle(),
      new Set([journalVoucherPermissions.reopenForAmendment]),
    );
    assert.deepEqual(view.actions.map((action) => action.action), ["reopen_for_amendment"]);
  });

  it("keeps submit, Post, Reversal and approval decisions behind canonical Application handlers", () => {
    assert.match(compositionSource, /handleSubmitJournalVoucherLifecycleCommand/u);
    assert.match(compositionSource, /handleDecideJournalVoucherLifecycleApprovalCommand/u);
    assert.match(compositionSource, /handlePostJournalVoucherLifecycleCommand/u);
    assert.match(compositionSource, /handleReverseJournalVoucherLifecycleCommand/u);
    assert.match(compositionSource, /SqliteJournalVoucherApprovalUnitOfWork/u);
    assert.match(compositionSource, /SqliteJournalVoucherPostingUnitOfWork/u);
    assert.match(compositionSource, /SqliteJournalVoucherReversalUnitOfWork/u);
    assert.match(overviewSource, /journalLifecycle\.submit/u);
    assert.match(approvalDetailsSource, /journalLifecycle\.decide/u);
    assert.doesNotMatch(overviewSource, /UPDATE\s+journal_vouchers/iu);
    assert.doesNotMatch(overviewSource, /INSERT\s+INTO\s+journal_/iu);
  });

  it("shows resolved company and branch labels instead of raw voucher identifiers", () => {
    assert.match(journalPageSource, /companyName=/u);
    assert.match(journalPageSource, /branchName=/u);
    assert.match(journalPageSource, /<dd>\{companyName\}<\/dd>/u);
    assert.match(journalPageSource, /<dd>\{branchName\}<\/dd>/u);
    assert.doesNotMatch(journalPageSource, /<dd>\{voucher\.companyId\}<\/dd>/u);
    assert.doesNotMatch(journalPageSource, /<dd>\{voucher\.branchId\s*\?\?\s*"—"\}<\/dd>/u);
  });

  it("keeps deliberate confirmation and exposes technical diagnostics for every failure", () => {
    assert.match(overviewSource, /window\.confirm/u);
    assert.match(overviewSource, /جزئیات فنی/u);

    const business = presentJournalVoucherLifecycleFailure(
      Object.assign(new Error("stale"), { code: "journal.version-conflict" }),
    );
    assert.equal(business.kind, "business");
    assert.match(business.technical ?? "", /journal\.version-conflict/u);
    assert.match(business.technical ?? "", /stale/u);

    const technical = presentJournalVoucherLifecycleFailure(new Error("disk unavailable"));
    assert.equal(technical.kind, "technical");
    assert.match(technical.technical ?? "", /disk unavailable/u);
  });
});
