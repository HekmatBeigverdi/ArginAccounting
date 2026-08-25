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
const accountingProviderSource = readFileSync(
  new URL("../src/composition/accounting/accounting-provider.tsx", import.meta.url),
  "utf8",
);
const lifecycleEffectsSource = readFileSync(
  new URL("../../../packages/accounting/src/application/journal-voucher-lifecycle-effects.ts", import.meta.url),
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

  it("makes edit, delete and submit executable instead of rendering silent actions", () => {
    assert.match(overviewSource, /action\.action === "edit"/u);
    assert.match(overviewSource, /openDraftEditor/u);
    assert.match(overviewSource, /action\.action === "delete"/u);
    assert.match(overviewSource, /journals\.delete/u);
    assert.match(overviewSource, /action\.action === "submit_for_approval"/u);
    assert.match(overviewSource, /onConfirm\("submit"/u);
  });

  it("refreshes the lifecycle snapshot before opening a confirmation dialog", () => {
    assert.match(overviewSource, /const openConfirmation = useCallback\(async/u);
    assert.match(overviewSource, /const freshLifecycle = await journalLifecycle\.get/u);
    assert.match(overviewSource, /lifecycle: freshLifecycle/u);
    assert.match(overviewSource, /candidate\.action === action\.action/u);
    assert.match(overviewSource, /setPendingAction\(\{ kind, row: freshRow, action: freshAction \}\)/u);
  });

  it("auto-invalidates accounting views after create, update, delete and lifecycle mutations", () => {
    assert.match(accountingProviderSource, /const \[dataRevision, setDataRevision\] = useState\(0\)/u);
    assert.match(accountingProviderSource, /runAccountingMutation/u);
    assert.match(accountingProviderSource, /journalServices\.create/u);
    assert.match(accountingProviderSource, /journalServices\.update/u);
    assert.match(accountingProviderSource, /journalServices\.delete/u);
    assert.match(accountingProviderSource, /lifecycleServices\.submit/u);
    assert.match(accountingProviderSource, /lifecycleServices\.decide/u);
    assert.match(accountingProviderSource, /lifecycleServices\.post/u);
    assert.match(accountingProviderSource, /lifecycleServices\.reverse/u);
    assert.match(accountingProviderSource, /journal\.post-commit-effects-failed/u);
  });

  it("does not open a second transaction for a single post-commit lifecycle audit insert", () => {
    assert.match(compositionSource, /createLifecycleAuditUnitOfWork\(auditDatabase\)/u);
    const start = compositionSource.indexOf("function createLifecycleAuditUnitOfWork");
    const end = compositionSource.indexOf("function asAuditDatabase", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const auditUnitOfWorkSource = compositionSource.slice(start, end);
    assert.match(auditUnitOfWorkSource, /return work\(\{ audit, approval \}\)/u);
    assert.doesNotMatch(auditUnitOfWorkSource, /database\.transaction/u);
  });

  it("identifies the exact post-commit effect stage when diagnostics are needed", () => {
    assert.match(lifecycleEffectsSource, /"audit" \| "event" \| "notification"/u);
    assert.match(lifecycleEffectsSource, /runPostCommitStage\("audit"/u);
    assert.match(lifecycleEffectsSource, /runPostCommitStage\("event"/u);
    assert.match(lifecycleEffectsSource, /runPostCommitStage\("notification"/u);
    assert.match(lifecycleEffectsSource, /cause: describeCause\(cause\)/u);
  });

  it("uses internal confirmation dialogs for submit and delete instead of native window.confirm", () => {
    assert.doesNotMatch(overviewSource, /window\.confirm/u);
    assert.match(overviewSource, /ConfirmationDialog/u);
    assert.match(overviewSource, /حذف پیش‌نویس قابل بازگردانی نیست/u);
    assert.match(overviewSource, /پس از ارسال، سند قفل می‌شود/u);
  });

  it("shows resolved company and branch labels instead of raw voucher identifiers", () => {
    assert.match(journalPageSource, /companyName=/u);
    assert.match(journalPageSource, /branchName=/u);
    assert.match(journalPageSource, /<dd>\{companyName\}<\/dd>/u);
    assert.match(journalPageSource, /<dd>\{branchName\}<\/dd>/u);
    assert.doesNotMatch(journalPageSource, /<dd>\{voucher\.companyId\}<\/dd>/u);
    assert.doesNotMatch(journalPageSource, /<dd>\{voucher\.branchId\s*\?\?\s*"—"\}<\/dd>/u);
  });

  it("exposes technical diagnostics for every lifecycle failure", () => {
    assert.match(overviewSource, /جزئیات فنی/u);
    assert.match(overviewSource, /console\.error/u);

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
