import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "../src/domain/journal-voucher.ts";
import { transitionJournalVoucher } from "../src/domain/journal-voucher-lifecycle.ts";
import {
  assertJournalVoucherDraftEditable,
  getJournalVoucherLockReason,
  isJournalVoucherEditable,
  JournalVoucherLockingError,
  reopenApprovedJournalVoucherForAmendment,
  type JournalVoucherAmendmentEvidence,
} from "../src/application/journal-voucher-locking.ts";
import type { JournalVoucher } from "../src/domain/journal-voucher.ts";
import type { JournalVoucherApprovalCycle } from "../src/application/journal-voucher-approval-integration.ts";

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
    createdAt: "2026-08-23T15:00:00.000Z",
  });
}

function transition(
  voucher: JournalVoucher,
  action:
    | "submit_for_approval"
    | "approval_approved"
    | "post"
    | "reverse",
  minute: number,
): JournalVoucher {
  return transitionJournalVoucher(voucher, {
    action,
    actorId: "user-1",
    occurredAt: `2026-08-23T15:${String(minute).padStart(2, "0")}:00.000Z`,
  }).voucher;
}

function pendingVoucher(): JournalVoucher {
  return transition(draftVoucher(), "submit_for_approval", 1);
}

function approvedVoucher(): JournalVoucher {
  return transition(pendingVoucher(), "approval_approved", 2);
}

function postedVoucher(): JournalVoucher {
  return transition(approvedVoucher(), "post", 3);
}

test("ordinary editing is allowed only for draft", () => {
  const draft = draftVoucher();
  assert.equal(isJournalVoucherEditable(draft), true);
  assert.equal(getJournalVoucherLockReason(draft), null);
  assert.doesNotThrow(() => assertJournalVoucherDraftEditable(draft));

  const locked = [
    [pendingVoucher(), "approval_pending"],
    [approvedVoucher(), "approved"],
    [postedVoucher(), "posted"],
    [transition(postedVoucher(), "reverse", 4), "reversed"],
  ] as const;

  for (const [voucher, reason] of locked) {
    assert.equal(isJournalVoucherEditable(voucher), false);
    assert.equal(getJournalVoucherLockReason(voucher), reason);
    assert.throws(
      () => assertJournalVoucherDraftEditable(voucher),
      (error: unknown) =>
        error instanceof JournalVoucherLockingError &&
        error.code === "journal.locked",
    );
  }
});

test("controlled amendment reopens approved voucher, closes approval cycle, and records evidence", async () => {
  let storedVoucher = approvedVoucher();
  const cycle: JournalVoucherApprovalCycle = Object.freeze({
    approvalRequestId: "approval-1",
    voucherId: storedVoucher.id,
    submittedContentVersion: 1,
    isCurrent: true,
  });
  let closedApprovalId: string | null = null;
  let evidence: JournalVoucherAmendmentEvidence | null = null;

  const result = await reopenApprovedJournalVoucherForAmendment(
    {
      voucherId: storedVoucher.id,
      companyId: storedVoucher.companyId,
      expectedVersion: storedVoucher.version,
      actor: { type: "user", id: "editor-1", displayName: "Editor" },
      occurredAt: "2026-08-23T15:10:00.000Z",
      reason: "  اصلاح   شرح سند  ",
    },
    {
      unitOfWork: {
        run: async (work) => work({
          getVoucher: async () => storedVoucher,
          saveVoucher: async (voucher, expectedVersion) => {
            assert.equal(expectedVersion, storedVoucher.version);
            storedVoucher = voucher;
          },
          getCurrentApprovalCycle: async () => cycle,
          closeApprovalCycle: async (approvalRequestId) => {
            closedApprovalId = approvalRequestId;
          },
          saveAmendmentEvidence: async (value) => {
            evidence = value;
          },
        }),
      },
    },
  );

  assert.equal(result.voucher.status, "draft");
  assert.equal(result.voucher.version, 4);
  assert.equal(closedApprovalId, "approval-1");
  assert.equal(evidence?.approvalRequestId, "approval-1");
  assert.equal(evidence?.reopenedBy, "editor-1");
  assert.equal(evidence?.reason, "اصلاح شرح سند");
  assert.equal(isJournalVoucherEditable(result.voucher), true);
});

test("controlled amendment requires approved state, current approval cycle, and a reason", async () => {
  const run = async (
    voucher: JournalVoucher,
    cycle: JournalVoucherApprovalCycle | null,
    reason: string,
  ) => reopenApprovedJournalVoucherForAmendment(
    {
      voucherId: voucher.id,
      companyId: voucher.companyId,
      expectedVersion: voucher.version,
      actor: { type: "user", id: "editor-1", displayName: "Editor" },
      occurredAt: "2026-08-23T15:10:00.000Z",
      reason,
    },
    {
      unitOfWork: {
        run: async (work) => work({
          getVoucher: async () => voucher,
          saveVoucher: async () => undefined,
          getCurrentApprovalCycle: async () => cycle,
          closeApprovalCycle: async () => undefined,
          saveAmendmentEvidence: async () => undefined,
        }),
      },
    },
  );

  await assert.rejects(
    () => run(draftVoucher(), null, "reason"),
    (error: unknown) =>
      error instanceof JournalVoucherLockingError &&
      error.code === "journal.amendment-not-allowed",
  );

  await assert.rejects(
    () => run(approvedVoucher(), null, "reason"),
    (error: unknown) =>
      error instanceof JournalVoucherLockingError &&
      error.code === "journal.approval-cycle-missing",
  );

  const approved = approvedVoucher();
  const cycle: JournalVoucherApprovalCycle = {
    approvalRequestId: "approval-1",
    voucherId: approved.id,
    submittedContentVersion: 1,
    isCurrent: true,
  };
  await assert.rejects(
    () => run(approved, cycle, "   "),
    (error: unknown) =>
      error instanceof JournalVoucherLockingError &&
      error.code === "journal.amendment-reason-required",
  );
});
