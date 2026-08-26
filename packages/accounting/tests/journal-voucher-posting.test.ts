import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRequest } from "@argin/audit";

import {
  createAccount,
  type CreateAccountInput,
} from "../src/index.ts";
import { createJournalVoucher } from "../src/domain/journal-voucher.ts";
import { transitionJournalVoucher } from "../src/domain/journal-voucher-lifecycle.ts";
import {
  assertJournalVoucherAccountingFactsMutable,
  JournalVoucherPostingError,
  postJournalVoucher,
  type JournalVoucherPostingDependencies,
} from "../src/application/journal-voucher-posting.ts";
import type { JournalVoucherApprovalCycle } from "../src/application/journal-voucher-approval-integration.ts";
import type { JournalFiscalContext } from "../src/validation/journal-voucher-eligibility.ts";

function account(id: string, overrides: Partial<CreateAccountInput> = {}) {
  return createAccount({
    id,
    companyId: "company-1",
    parentId: "general-1",
    level: "subsidiary",
    code: id === "account-debit" ? "110101" : "210101",
    name: id,
    nature: id === "account-debit" ? "debit" : "credit",
    normalBalance: id === "account-debit" ? "debit" : "credit",
    statementType: "balance_sheet",
    postingAllowed: true,
    status: "active",
    createdAt: "2026-03-21T00:00:00.000Z",
    ...overrides,
  });
}

const fiscal: JournalFiscalContext = {
  companyId: "company-1",
  fiscalYearId: "fy-1405",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalYearStatus: "open",
  fiscalPeriodId: "period-01",
  fiscalPeriodStartDate: "2026-03-21",
  fiscalPeriodEndDate: "2026-04-20",
  fiscalPeriodStatus: "open",
};

function approvedFixture() {
  const draft = createJournalVoucher({
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "JV-000001",
    voucherDate: "2026-04-01",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "period-01",
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

  const pending = transitionJournalVoucher(draft, {
    action: "submit_for_approval",
    actorId: "user-1",
    occurredAt: "2026-08-23T15:01:00.000Z",
  }).voucher;
  const approved = transitionJournalVoucher(pending, {
    action: "approval_approved",
    actorId: "approver-1",
    occurredAt: "2026-08-23T15:02:00.000Z",
  }).voucher;

  const cycle: JournalVoucherApprovalCycle = {
    approvalRequestId: "approval-1",
    voucherId: approved.id,
    submittedContentVersion: draft.version,
    isCurrent: true,
  };

  const approval: ApprovalRequest = {
    id: "approval-1",
    version: 3,
    requestType: "accounting.journal-voucher",
    title: "Journal Voucher JV-000001",
    description: null,
    status: "approved",
    target: {
      entityType: "accounting.journal-voucher",
      entityId: approved.id,
      entityDisplayName: approved.number,
    },
    scope: {
      companyId: approved.companyId,
      branchId: approved.branchId,
      fiscalYearId: approved.fiscalYearId,
    },
    requestedBy: { type: "user", id: "user-1", displayName: "User" },
    requestedAt: "2026-08-23T15:01:00.000Z",
    decidedBy: { type: "user", id: "approver-1", displayName: "Approver" },
    decidedAt: "2026-08-23T15:02:00.000Z",
    decisionComment: null,
    createdAt: "2026-08-23T15:01:00.000Z",
    updatedAt: "2026-08-23T15:02:00.000Z",
    history: [],
  };

  return { approved, approval, cycle };
}

function dependencies(
  fixture = approvedFixture(),
  fiscalOverride: JournalFiscalContext = fiscal,
): JournalVoucherPostingDependencies {
  return {
    accounts: {
      async findById(id) {
        if (id === "account-debit" || id === "account-credit") return account(id);
        return null;
      },
    },
    fiscalContext: {
      async resolve() {
        return fiscalOverride;
      },
    },
    dimensions: {
      async findPoliciesForAccounts() { return []; },
      async findTypesByCompanyId() { return []; },
      async findMembersByIds() { return []; },
    },
    unitOfWork: {
      async run(work) {
        return work({
          async getVoucher() { return fixture.approved; },
          async getCurrentApprovalCycle() { return fixture.cycle; },
          async getApprovalRequest() { return fixture.approval; },
          async savePostedVoucher() {},
        });
      },
    },
  };
}

test("posts only an approved voucher with current exact approval evidence", async () => {
  const fixture = approvedFixture();
  const result = await postJournalVoucher({
    voucherId: fixture.approved.id,
    companyId: fixture.approved.companyId,
    expectedVersion: fixture.approved.version,
    actorId: "poster-1",
    occurredAt: "2026-08-23T15:03:00.000Z",
    postingReference: "POST-0001",
  }, dependencies(fixture));

  assert.equal(result.voucher.status, "posted");
  assert.equal(result.voucher.version, fixture.approved.version + 1);
  assert.equal(result.evidence.approvalRequestId, fixture.approval.id);
  assert.equal(result.evidence.postedBy, "poster-1");
  assert.equal(result.evidence.postingReference, "POST-0001");
  assert.equal(result.evidence.postedAt, "2026-08-23T15:03:00.000Z");
});

test("revalidates fiscal eligibility immediately before posting", async () => {
  const fixture = approvedFixture();

  await assert.rejects(
    () => postJournalVoucher({
      voucherId: fixture.approved.id,
      companyId: fixture.approved.companyId,
      expectedVersion: fixture.approved.version,
      actorId: "poster-1",
      occurredAt: "2026-08-23T15:03:00.000Z",
    }, dependencies(fixture, { ...fiscal, fiscalPeriodStatus: "locked" })),
    (error: unknown) =>
      error instanceof JournalVoucherPostingError &&
      error.code === "journal.posting-validation-failed",
  );
});

test("rejects stale or non-current approval evidence", async () => {
  const fixture = approvedFixture();
  const stale = {
    ...fixture,
    cycle: { ...fixture.cycle, submittedContentVersion: fixture.cycle.submittedContentVersion - 1 },
  };

  await assert.rejects(
    () => postJournalVoucher({
      voucherId: stale.approved.id,
      companyId: stale.approved.companyId,
      expectedVersion: stale.approved.version,
      actorId: "poster-1",
      occurredAt: "2026-08-23T15:03:00.000Z",
    }, dependencies(stale)),
    (error: unknown) =>
      error instanceof JournalVoucherPostingError &&
      error.code === "journal.approval-content-version-mismatch",
  );
});

test("treats posted and reversed accounting facts as immutable", () => {
  const fixture = approvedFixture();
  const posted = transitionJournalVoucher(fixture.approved, {
    action: "post",
    actorId: "poster-1",
    occurredAt: "2026-08-23T15:03:00.000Z",
  }).voucher;
  const reversed = transitionJournalVoucher(posted, {
    action: "reverse",
    actorId: "user-2",
    occurredAt: "2026-08-23T15:04:00.000Z",
  }).voucher;

  assert.throws(
    () => assertJournalVoucherAccountingFactsMutable(posted),
    JournalVoucherPostingError,
  );
  assert.throws(
    () => assertJournalVoucherAccountingFactsMutable(reversed),
    JournalVoucherPostingError,
  );
});
