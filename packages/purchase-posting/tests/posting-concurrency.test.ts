import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "@argin/accounting/journal";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  assertNewJournalDraftVersion,
  assertPurchasePostingConcurrency,
  createPurchasePosting,
  createPurchasePostingSourceIdentity,
  rehydratePurchasePosting,
} from "../src/index.ts";

const source = createPurchasePostingSourceIdentity({
  companyId: "company-001",
  branchId: "branch-001",
  sourceType: "supplier-invoice",
  sourceId: "invoice-001",
  sourceVersion: 3,
  sourceRevision: 1,
});

test("accepts current draft Posting when optimistic version and scope match", () => {
  const current = createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-23T09:00:00.000Z",
  });

  assert.doesNotThrow(() => assertPurchasePostingConcurrency(current, {
    postingId: "posting-001",
    expectedPostingVersion: 1,
    source,
  }));
});

test("rejects stale expected version", () => {
  const current = rehydratePurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    status: "draft",
    journalVoucherId: null,
    version: 2,
    createdAt: "2026-09-23T09:00:00.000Z",
    updatedAt: "2026-09-23T09:10:00.000Z",
  });

  assert.throws(
    () => assertPurchasePostingConcurrency(current, {
      postingId: "posting-001",
      expectedPostingVersion: 1,
      companyId: "company-001",
      branchId: "branch-001",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict);
      return true;
    },
  );
});

test("rejects prepared Posting as stale mutation target", () => {
  const current = rehydratePurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    status: "prepared",
    journalVoucherId: "voucher-001",
    version: 2,
    createdAt: "2026-09-23T09:00:00.000Z",
    updatedAt: "2026-09-23T09:10:00.000Z",
  });

  assert.throws(
    () => assertPurchasePostingConcurrency(current, {
      postingId: "posting-001",
      expectedPostingVersion: 2,
      companyId: "company-001",
      branchId: "branch-001",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch);
      return true;
    },
  );
});

test("new Journal draft must start at version 1", () => {
  const journal = createJournalVoucher({
    id: "voucher-001",
    companyId: "company-001",
    branchId: "branch-001",
    number: "JV-000001",
    voucherDate: "2026-09-23",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    currency: "IRR",
    source: { type: "source_document", sourceId: "invoice-001" },
    lines: [
      { id: "line-1", order: 1, accountId: "a", debit: 100, credit: 0 },
      { id: "line-2", order: 2, accountId: "b", debit: 0, credit: 100 },
    ],
    createdAt: "2026-09-23T09:00:00.000Z",
  });

  assert.doesNotThrow(() => assertNewJournalDraftVersion(journal));
  assert.throws(
    () => assertNewJournalDraftVersion({ ...journal, version: 2 }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.journalVersionConflict);
      return true;
    },
  );
});
