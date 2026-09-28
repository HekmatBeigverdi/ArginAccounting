import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseFulfillmentAccountingPolicy,
  createPurchasePosting,
  createPurchasePostingFact,
  createPurchasePostingSourceIdentityFromFact,
  createPurchasePostingTraceContext,
  evaluateSupplierInvoiceAccountingEligibility,
  orchestrateSupplierInvoicePosting,
} from "../src/index.ts";

const fact = createPurchasePostingFact({
  factId: "fact-1",
  companyId: "c1",
  branchId: "b1",
  fiscalYearId: "fy1",
  fiscalPeriodId: "fp1",
  purchaseDocumentId: "inv1",
  purchaseDocumentVersion: 1,
  documentType: "supplier-invoice",
  sourceStatus: "confirmed",
  documentNumber: "PI-1",
  businessDate: "2026-09-28",
  supplier: {
    companyId: "c1", supplierId: "s1", code: "S1", displayName: "Supplier",
    nationalCode: null, nationalId: null, economicNumber: null, taxFileNumber: null,
  },
  lines: [{
    purchaseLineId: "l1",
    position: 1,
    lineKind: "service",
    item: {
      itemId: "svc1", itemType: "service", code: "SV1", displayName: "Service",
      taxpayerGoodsServiceId: null, stockTracking: false,
    },
    baseQuantity: "1",
    amounts: {
      currency: "IRR", grossAmount: 1000, discountAmount: 0,
      netAfterDiscount: 1000, chargeAmount: 0, taxBaseAmount: 1000,
      taxAmount: 0, grandTotal: 1000,
    },
    valuations: [],
  }],
  totals: {
    currency: "IRR", grossAmount: 1000, discountAmount: 0,
    netAfterDiscount: 1000, chargeAmount: 0, taxBaseAmount: 1000,
    taxAmount: 0, grandTotal: 1000,
  },
  capturedAt: "2026-09-28T08:00:00.000Z",
});

const automaticPolicy = createPurchaseFulfillmentAccountingPolicy("automatic");
const automaticEligibility = evaluateSupplierInvoiceAccountingEligibility({
  sourceStatus: "confirmed",
  policy: automaticPolicy,
  lines: [{ purchaseLineId: "l1", lineKind: "service", fulfillmentState: "not-required" }],
});

test("orchestrator defers accountant-approval mode without creating a Journal", async () => {
  let touched = false;
  const result = await orchestrateSupplierInvoicePosting({
    fact,
    source: createPurchasePostingSourceIdentityFromFact(fact),
    trace: createPurchasePostingTraceContext({
      requestId: "r1", operationId: "o1", correlationId: "c1",
    }),
    eligibility: {
      ...automaticEligibility,
      status: "awaiting-accountant-approval",
      requiresAccountantApproval: true,
      shouldPostAutomatically: false,
    },
    postingMode: "accountant-approval",
    taxRecoverability: "recoverable",
    taxPolicyId: "tax-default",
    payloadFingerprint: "a".repeat(64),
    occurredAt: "2026-09-28T08:00:00.000Z",
    journal: { voucherId: "j1", voucherNumber: "JV1", lineIds: ["jl1", "jl2"], createdAt: "2026-09-28T08:00:00.000Z" },
  }, {
    posting: { async loadOrCreate() { touched = true; return createPurchasePosting({ postingId: "p1", companyId: "c1", branchId: "b1", createdAt: "2026-09-28T08:00:00.000Z" }); } },
    rules: { async listActive() { return []; } },
    accounts: { async findById() { return null; } },
    dimensions: { async findDimensionTypeId() { return null; }, async findBranchMemberId() { return null; }, async findPartyMemberId() { return null; } },
    unitOfWork: { async run() { throw new Error("must not run"); } },
  });

  assert.equal(result.status, "awaiting-accountant-approval");
  assert.equal(touched, false);
});

test("orchestrator creates a replay-safe Journal when automatic eligibility is ready", async () => {
  const posting = createPurchasePosting({
    postingId: "p1", companyId: "c1", branchId: "b1", createdAt: "2026-09-28T08:00:00.000Z",
  });
  const accounts = new Map([
    ["expense", { accountId: "expense", companyId: "c1", code: "6101", name: "Expense", status: "active" as const, postingAllowed: true }],
    ["payable", { accountId: "payable", companyId: "c1", code: "2101", name: "Payable", status: "active" as const, postingAllowed: true }],
  ]);
  let persistedPosting = posting;
  let storedJournal: any = null;
  let storedRecord: any = null;

  const result = await orchestrateSupplierInvoicePosting({
    fact,
    source: createPurchasePostingSourceIdentityFromFact(fact),
    trace: createPurchasePostingTraceContext({
      requestId: "r2", operationId: "o2", correlationId: "c2",
    }),
    eligibility: automaticEligibility,
    postingMode: "automatic",
    taxRecoverability: "recoverable",
    taxPolicyId: "tax-default",
    payloadFingerprint: "b".repeat(64),
    occurredAt: "2026-09-28T08:00:00.000Z",
    journal: {
      voucherId: "j2", voucherNumber: "JV2", lineIds: ["jl1", "jl2"],
      createdAt: "2026-09-28T08:00:00.000Z",
    },
  }, {
    posting: { async loadOrCreate() { return persistedPosting; } },
    rules: { async listActive() { return [
      { ruleId: "r-exp", companyId: "c1", branchId: null, eventKind: null, lineKind: "service", accountRole: "purchase-expense", accountId: "expense", priority: 1, active: true },
      { ruleId: "r-ap", companyId: "c1", branchId: null, eventKind: null, lineKind: null, accountRole: "accounts-payable", accountId: "payable", priority: 1, active: true },
    ]; } },
    accounts: { async findById(_companyId, accountId) { return accounts.get(accountId) ?? null; } },
    dimensions: { async findDimensionTypeId() { return null; }, async findBranchMemberId() { return null; }, async findPartyMemberId() { return null; } },
    unitOfWork: {
      async run(work) {
        return work({
          async findIdempotencyRecord() { return storedRecord; },
          async resolveFiscalContext() {
            return { companyId: "c1", fiscalYearId: "fy1", fiscalYearStartDate: "2026-03-21", fiscalYearEndDate: "2027-03-20", fiscalYearStatus: "open", fiscalPeriodId: "fp1", fiscalPeriodStartDate: "2026-09-23", fiscalPeriodEndDate: "2026-10-22", fiscalPeriodStatus: "open" };
          },
          async findActiveHistoricalLocks() { return []; },
          async findPosting() { return persistedPosting; },
          async findPreparedPosting() { return persistedPosting.status === "prepared" ? persistedPosting : null; },
          async findJournalDraft() { return storedJournal; },
          async createJournalDraft(value) { storedJournal = value; },
          async savePreparedPosting(value) { persistedPosting = value; },
          async saveIdempotencyRecord(value) { storedRecord = value; },
        });
      },
    },
  });

  assert.equal(result.status, "journal-created");
  assert.equal(result.posting?.status, "prepared");
  assert.equal(result.journal?.totalDebit.amount, 1000);
  assert.equal(result.journal?.totalCredit.amount, 1000);
});
