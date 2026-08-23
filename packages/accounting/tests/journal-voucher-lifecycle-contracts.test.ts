import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "../src/domain/journal-voucher.ts";
import { projectJournalVoucherListItem } from "../src/application/journal-voucher-read-model.ts";
import {
  getJournalVoucherLifecycle,
  type JournalVoucherLifecycleReader,
} from "../src/application/journal-voucher-lifecycle-queries.ts";

function voucher(status: "draft" | "pending_approval" | "approved" | "posted" | "reversed") {
  const draft = createJournalVoucher({
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "JV-000001",
    voucherDate: "2026-08-23",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-06",
    lines: [
      { id: "line-1", order: 1, accountId: "cash", debit: 1000, credit: 0 },
      { id: "line-2", order: 2, accountId: "revenue", debit: 0, credit: 1000 },
    ],
    createdAt: "2026-08-23T12:00:00.000Z",
  });
  return Object.freeze({ ...draft, status });
}

function readerFor(status: Parameters<typeof voucher>[0]): JournalVoucherLifecycleReader {
  const current = voucher(status);
  return {
    async findVoucher() { return current; },
    async findCurrentApprovalCycle() {
      if (status !== "pending_approval" && status !== "approved" && status !== "posted") return null;
      return {
        approvalRequestId: "approval-1",
        voucherId: current.id,
        submittedContentVersion: 1,
        isCurrent: true,
      };
    },
    async findPostingEvidence() {
      return status === "posted" || status === "reversed"
        ? {
            voucherId: current.id,
            approvalRequestId: "approval-1",
            submittedContentVersion: 1,
            postedVersion: 4,
            postedBy: "user-2",
            postedAt: "2026-08-23T13:00:00.000Z",
            postingReference: "POST-1",
          }
        : null;
    },
    async findLatestAmendmentEvidence() { return null; },
    async findReversalLineage() {
      return status === "reversed"
        ? {
            originalVoucherId: current.id,
            reversalVoucherId: "voucher-reversal-1",
            replacementVoucherId: null,
            requestId: "reverse-request-1",
            reversedBy: "user-3",
            reversedAt: "2026-08-23T14:00:00.000Z",
            reason: "اصلاح ثبت",
          }
        : null;
    },
  };
}

test("list projection exposes persisted lifecycle status", () => {
  const item = projectJournalVoucherListItem(voucher("approved"));
  assert.equal(item.status, "approved");
});

test("draft lifecycle query exposes state-policy edit submit capabilities", async () => {
  const result = await getJournalVoucherLifecycle(
    { companyId: "company-1", voucherId: "voucher-1" },
    readerFor("draft"),
  );

  assert.equal(result.status, "draft");
  assert.equal(result.capabilities.editable, true);
  assert.deepEqual(result.capabilities.actions, ["edit", "delete", "submit_for_approval"]);
});

test("approved lifecycle query exposes current approval and pre-post actions", async () => {
  const result = await getJournalVoucherLifecycle(
    { companyId: "company-1", voucherId: "voucher-1" },
    readerFor("approved"),
  );

  assert.equal(result.approval?.status, "approved");
  assert.equal(result.approval?.isCurrent, true);
  assert.deepEqual(result.capabilities.actions, ["reopen_for_amendment", "post"]);
});

test("posted and reversed query surfaces traceability without edit capability", async () => {
  const posted = await getJournalVoucherLifecycle(
    { companyId: "company-1", voucherId: "voucher-1" },
    readerFor("posted"),
  );
  assert.equal(posted.capabilities.editable, false);
  assert.deepEqual(posted.capabilities.actions, ["reverse"]);
  assert.equal(posted.posting?.postingReference, "POST-1");

  const reversed = await getJournalVoucherLifecycle(
    { companyId: "company-1", voucherId: "voucher-1" },
    readerFor("reversed"),
  );
  assert.deepEqual(reversed.capabilities.actions, []);
  assert.equal(reversed.reversal?.reversalVoucherId, "voucher-reversal-1");
});
