import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "@argin/accounting/journal";

import {
  createPurchasePosting,
  createPurchasePostingSourceIdentity,
  evaluatePurchasePostingReconciliation,
  preparePurchasePosting,
  rehydratePurchasePosting,
} from "../src/index.ts";

const source = createPurchasePostingSourceIdentity({
  companyId: "company-001",
  branchId: "branch-001",
  sourceType: "supplier-invoice",
  sourceId: "invoice-001",
  sourceVersion: 1,
  sourceRevision: null,
});

function journal(id = "journal-001") {
  return createJournalVoucher({
    id,
    companyId: "company-001",
    branchId: "branch-001",
    number: "JV-001",
    voucherDate: "2026-09-24",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    currency: "IRR",
    source: {
      type: "source_document",
      sourceId: "invoice-001",
      requestId: "request-001",
      correlationId: "correlation-001",
      causationId: null,
    },
    lines: [
      { id: id + "-1", order: 1, accountId: "inventory", debit: 100, credit: 0 },
      { id: id + "-2", order: 2, accountId: "payable", debit: 0, credit: 100 },
    ],
    createdAt: "2026-09-24T07:00:00.000Z",
  });
}

function preparedPosting() {
  return preparePurchasePosting(createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-24T07:00:00.000Z",
  }), {
    journalVoucherId: "journal-001",
    expectedVersion: 1,
    occurredAt: "2026-09-24T07:05:00.000Z",
  });
}

test("healthy Purchase Posting and Journal reconcile with no issues", () => {
  const issues = evaluatePurchasePostingReconciliation({
    source,
    posting: preparedPosting(),
    journal: journal(),
    reversal: null,
    reversalJournal: null,
  });
  assert.deepEqual(issues, []);
});

test("missing Posting and Journal links are explicit reconciliation issues", () => {
  const issues = evaluatePurchasePostingReconciliation({
    source,
    posting: null,
    journal: null,
    reversal: null,
    reversalJournal: null,
  });
  assert.deepEqual(issues, ["posting-missing", "journal-missing"]);
});

test("source and Branch mismatches are detected", () => {
  const wrongJournal = createJournalVoucher({
    id: "journal-001",
    companyId: "company-001",
    branchId: "branch-other",
    number: "JV-001",
    voucherDate: "2026-09-24",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    currency: "IRR",
    source: { type: "source_document", sourceId: "invoice-other" },
    lines: [
      { id: "x1", order: 1, accountId: "a", debit: 100, credit: 0 },
      { id: "x2", order: 2, accountId: "b", debit: 0, credit: 100 },
    ],
    createdAt: "2026-09-24T07:00:00.000Z",
  });

  const issues = evaluatePurchasePostingReconciliation({
    source,
    posting: preparedPosting(),
    journal: wrongJournal,
    reversal: null,
    reversalJournal: null,
  });
  assert.ok(issues.includes("source-mismatch"));
  assert.ok(issues.includes("branch-mismatch"));
});

test("reversed Posting requires durable reversal lineage and reversal Journal", () => {
  const reversed = rehydratePurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    status: "reversed",
    journalVoucherId: "journal-001",
    version: 5,
    createdAt: "2026-09-24T07:00:00.000Z",
    updatedAt: "2026-09-24T08:00:00.000Z",
  });

  assert.deepEqual(evaluatePurchasePostingReconciliation({
    source,
    posting: reversed,
    journal: journal(),
    reversal: null,
    reversalJournal: null,
  }), ["reversal-lineage-missing"]);
});
