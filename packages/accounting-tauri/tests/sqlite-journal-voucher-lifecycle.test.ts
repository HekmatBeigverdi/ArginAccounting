import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  JournalVoucher,
  JournalVoucherApprovalGateway,
} from "@argin/accounting/journal";
import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import {
  SqliteJournalVoucherApprovalUnitOfWork,
  SqliteJournalVoucherAmendmentUnitOfWork,
  SqliteJournalVoucherPostingUnitOfWork,
  SqliteJournalVoucherReversalUnitOfWork,
} from "../src/index.ts";

class FakeDatabase implements DatabaseExecutor {
  readonly executed: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  transactions = 0;

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    this.executed.push({ sql, parameters });
    return { rowsAffected: 1 };
  }

  async query<T>(): Promise<T[]> { return []; }
  async queryOne<T>(): Promise<T | null> { return null; }

  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return operation(this);
  }

  async close(): Promise<void> {}
}

function voucher(status: JournalVoucher["status"], version: number, id = "voucher-1"): JournalVoucher {
  return {
    id,
    companyId: "company-1",
    branchId: null,
    number: "000001",
    reference: null,
    voucherDate: "2026-08-24",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "period-1",
    description: null,
    status,
    currency: "IRR",
    source: {
      type: "manual",
      sourceId: null,
      requestId: null,
      correlationId: null,
      causationId: null,
    },
    lines: [],
    totalDebit: { amount: 0, currency: "IRR" },
    totalCredit: { amount: 0, currency: "IRR" },
    createdAt: "2026-08-24T09:00:00.000Z",
    updatedAt: "2026-08-24T10:00:00.000Z",
    version,
  } as unknown as JournalVoucher;
}

describe("sqlite journal lifecycle adapters", () => {
  it("keeps controlled amendment state, approval-cycle close, and evidence in one transaction", async () => {
    const db = new FakeDatabase();
    const unit = new SqliteJournalVoucherAmendmentUnitOfWork(db);

    await unit.run(async (session) => {
      await session.saveVoucher(voucher("draft", 4), 3);
      await session.closeApprovalCycle("approval-1");
      await session.saveAmendmentEvidence({
        voucherId: "voucher-1",
        approvalRequestId: "approval-1",
        previousVersion: 3,
        reopenedVersion: 4,
        reopenedBy: "user-2",
        reopenedAt: "2026-08-24T10:00:00.000Z",
        reason: "Correction required",
      });
    });

    assert.equal(db.transactions, 1);
    assert.ok(db.executed.some(({ sql }) => sql.includes("SET lifecycle_status = ?")));
    assert.ok(db.executed.some(({ sql }) => sql.includes("journal_voucher_approval_cycles")));
    assert.ok(db.executed.some(({ sql }) => sql.includes("journal_voucher_amendment_evidence")));
  });

  it("persists original transition, reversal voucher, and lineage in one transaction", async () => {
    const db = new FakeDatabase();
    const unit = new SqliteJournalVoucherReversalUnitOfWork(db);

    await unit.run((session) => session.saveReversal({
      originalVoucher: voucher("reversed", 6, "original-1"),
      expectedOriginalVersion: 5,
      reversalVoucher: voucher("posted", 1, "reversal-1"),
      lineage: {
        originalVoucherId: "original-1",
        reversalVoucherId: "reversal-1",
        replacementVoucherId: null,
        requestId: "request-1",
        reversedBy: "user-3",
        reversedAt: "2026-08-24T10:00:00.000Z",
        reason: "Reverse incorrect entry",
      },
    }));

    assert.equal(db.transactions, 1);
    assert.ok(db.executed.some(({ sql }) => sql.includes("UPDATE journal_vouchers") && sql.includes("version = ?")));
    assert.ok(db.executed.some(({ sql }) => sql.includes("INSERT INTO journal_vouchers")));
    assert.ok(db.executed.some(({ sql }) => sql.includes("journal_voucher_reversal_lineage")));
  });

  it("uses the exact transaction session for approval gateway creation", async () => {
    const db = new FakeDatabase();
    let gatewaySession: DatabaseSession | null = null;
    const gateway: JournalVoucherApprovalGateway = {
      async createAndSubmit() { throw new Error("not called"); },
      async applyDecision() { throw new Error("not called"); },
    };
    const unit = new SqliteJournalVoucherApprovalUnitOfWork(db, (session) => {
      gatewaySession = session;
      return gateway;
    });

    await unit.run(async (session) => {
      assert.equal(session.approval, gateway);
    });

    assert.equal(db.transactions, 1);
    assert.equal(gatewaySession, db);
  });

  it("persists final posting state and posting evidence atomically", async () => {
    const db = new FakeDatabase();
    const unit = new SqliteJournalVoucherPostingUnitOfWork(db, () => ({
      async getApprovalRequest() { return null; },
    }));

    await unit.run((session) => session.savePostedVoucher(
      voucher("posted", 5),
      4,
      {
        voucherId: "voucher-1",
        approvalRequestId: "approval-1",
        submittedContentVersion: 2,
        postedVersion: 5,
        postedBy: "user-4",
        postedAt: "2026-08-24T10:00:00.000Z",
        postingReference: "POST-1",
      },
    ));

    assert.equal(db.transactions, 1);
    assert.ok(db.executed.some(({ sql }) => sql.includes("journal_voucher_posting_evidence")));
  });
});
