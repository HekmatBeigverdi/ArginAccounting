import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRequest } from "@argin/audit";
import { createJournalVoucher, type JournalVoucher } from "../src/domain/journal-voucher.ts";
import {
  decideJournalVoucherApproval,
  JournalVoucherApprovalIntegrationError,
  submitJournalVoucherForApproval,
  type JournalVoucherApprovalCycle,
  type JournalVoucherApprovalSession,
  type JournalVoucherApprovalUnitOfWork,
} from "../src/application/journal-voucher-approval-integration.ts";

function createVoucher(): JournalVoucher {
  return createJournalVoucher({
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "JV-000001",
    voucherDate: "2026-08-23",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-06",
    lines: [
      { id: "line-1", order: 1, accountId: "a-1", debit: 1000, credit: 0 },
      { id: "line-2", order: 2, accountId: "a-2", debit: 0, credit: 1000 },
    ],
    createdAt: "2026-08-23T10:00:00.000Z",
  });
}

function approval(status: ApprovalRequest["status"], version = 2): ApprovalRequest {
  return {
    id: "approval-1",
    version,
    requestType: "accounting.journal-voucher",
    title: "Journal Voucher JV-000001",
    description: null,
    status,
    target: {
      entityType: "accounting.journal-voucher",
      entityId: "voucher-1",
      entityDisplayName: "JV-000001",
    },
    scope: {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fy-1405",
    },
    requestedBy: { type: "user", id: "user-1", displayName: "User 1" },
    requestedAt: "2026-08-23T10:01:00.000Z",
    decidedBy: status === "approved" ? { type: "user", id: "user-2", displayName: "User 2" } : null,
    decidedAt: status === "approved" ? "2026-08-23T10:02:00.000Z" : null,
    decisionComment: null,
    createdAt: "2026-08-23T10:01:00.000Z",
    updatedAt: "2026-08-23T10:02:00.000Z",
    history: [],
  };
}

function harness() {
  let voucher = createVoucher();
  let cycle: JournalVoucherApprovalCycle | null = null;
  let nextDecision: ApprovalRequest["status"] = "approved";

  const session: JournalVoucherApprovalSession = {
    async getVoucher() { return voucher; },
    async saveVoucher(next) { voucher = next; },
    async getCurrentApprovalCycle() { return cycle; },
    async saveApprovalCycle(next) { cycle = next; },
    async closeApprovalCycle() {
      if (cycle) cycle = Object.freeze({ ...cycle, isCurrent: false });
    },
    approval: {
      async createAndSubmit() { return approval("pending", 2); },
      async applyDecision() { return approval(nextDecision, 3); },
    },
  };

  const unitOfWork: JournalVoucherApprovalUnitOfWork = {
    async run(work) { return work(session); },
  };

  return {
    unitOfWork,
    getVoucher: () => voucher,
    getCycle: () => cycle,
    setDecision: (status: ApprovalRequest["status"]) => { nextDecision = status; },
  };
}

const actor = { type: "user" as const, id: "user-1", displayName: "User 1" };

test("submits a draft through the shared Approval contract and creates one current cycle", async () => {
  const h = harness();
  const result = await submitJournalVoucherForApproval({
    voucherId: "voucher-1",
    companyId: "company-1",
    expectedVersion: 1,
    actor,
    occurredAt: "2026-08-23T10:01:00.000Z",
  }, { unitOfWork: h.unitOfWork });

  assert.equal(result.voucher.status, "pending_approval");
  assert.equal(result.approvalRequest.status, "pending");
  assert.equal(result.cycle.submittedContentVersion, 1);
  assert.equal(result.cycle.isCurrent, true);
});

test("maps Approval approve to Journal approved while retaining the current approval evidence", async () => {
  const h = harness();
  await submitJournalVoucherForApproval({
    voucherId: "voucher-1",
    companyId: "company-1",
    expectedVersion: 1,
    actor,
    occurredAt: "2026-08-23T10:01:00.000Z",
  }, { unitOfWork: h.unitOfWork });

  const result = await decideJournalVoucherApproval({
    voucherId: "voucher-1",
    companyId: "company-1",
    expectedVoucherVersion: 2,
    expectedApprovalVersion: 2,
    decision: "approve",
    actor: { type: "user", id: "user-2", displayName: "User 2" },
    occurredAt: "2026-08-23T10:02:00.000Z",
  }, { unitOfWork: h.unitOfWork });

  assert.equal(result.voucher.status, "approved");
  assert.equal(result.approvalRequest.status, "approved");
  assert.equal(result.cycle.isCurrent, true);
});

test("reject closes the approval cycle and returns the Journal voucher to draft for a new cycle", async () => {
  const h = harness();
  await submitJournalVoucherForApproval({
    voucherId: "voucher-1",
    companyId: "company-1",
    expectedVersion: 1,
    actor,
    occurredAt: "2026-08-23T10:01:00.000Z",
  }, { unitOfWork: h.unitOfWork });

  h.setDecision("rejected");
  const result = await decideJournalVoucherApproval({
    voucherId: "voucher-1",
    companyId: "company-1",
    expectedVoucherVersion: 2,
    expectedApprovalVersion: 2,
    decision: "reject",
    actor: { type: "user", id: "user-2", displayName: "User 2" },
    occurredAt: "2026-08-23T10:02:00.000Z",
  }, { unitOfWork: h.unitOfWork });

  assert.equal(result.voucher.status, "draft");
  assert.equal(result.cycle.isCurrent, false);
  assert.equal(h.getCycle()?.isCurrent, false);
});

test("prevents a second submission while a current approval cycle exists", async () => {
  const h = harness();
  await submitJournalVoucherForApproval({
    voucherId: "voucher-1",
    companyId: "company-1",
    expectedVersion: 1,
    actor,
    occurredAt: "2026-08-23T10:01:00.000Z",
  }, { unitOfWork: h.unitOfWork });

  await assert.rejects(
    submitJournalVoucherForApproval({
      voucherId: "voucher-1",
      companyId: "company-1",
      expectedVersion: 2,
      actor,
      occurredAt: "2026-08-23T10:03:00.000Z",
    }, { unitOfWork: h.unitOfWork }),
    (error: unknown) => error instanceof JournalVoucherApprovalIntegrationError,
  );
});
