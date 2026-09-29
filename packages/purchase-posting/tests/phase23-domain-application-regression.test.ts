import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseFulfillmentAccountingPolicy,
  createPurchasePostingFact,
  createPurchasePostingSourceIdentityFromFact,
  createPurchasePostingTraceContext,
  evaluateSupplierInvoiceAccountingEligibility,
  orchestrateSupplierInvoicePosting,
} from "../src/index.ts";

const serviceFact = createPurchasePostingFact({
  factId: "fact-step32",
  companyId: "company",
  branchId: "branch",
  fiscalYearId: "fy",
  fiscalPeriodId: "fp",
  purchaseDocumentId: "invoice",
  purchaseDocumentVersion: 4,
  documentType: "supplier-invoice",
  sourceStatus: "confirmed",
  documentNumber: "PI-000032",
  businessDate: "2026-09-28",
  supplier: {
    companyId: "company", supplierId: "supplier", code: "S1", displayName: "Supplier",
    nationalCode: null, nationalId: null, economicNumber: null, taxFileNumber: null,
  },
  lines: [{
    purchaseLineId: "service-line",
    position: 1,
    lineKind: "service",
    item: {
      itemId: "service", itemType: "service", code: "SV1", displayName: "Service",
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
  capturedAt: "2026-09-28T19:00:00.000Z",
});

const baseInput = {
  fact: serviceFact,
  source: createPurchasePostingSourceIdentityFromFact(serviceFact),
  trace: createPurchasePostingTraceContext({
    requestId: "request-step32",
    operationId: "operation-step32",
    correlationId: "correlation-step32",
  }),
  taxRecoverability: "recoverable" as const,
  taxPolicyId: "tax-policy",
  payloadFingerprint: "c".repeat(64),
  occurredAt: "2026-09-28T19:00:00.000Z",
  journal: {
    voucherId: "journal-step32",
    voucherNumber: "JV-STEP32",
    lineIds: [] as readonly string[],
    createdAt: "2026-09-28T19:00:00.000Z",
  },
};

const untouchableDeps = () => ({
  posting: { async loadOrCreate(): Promise<never> { throw new Error("posting must not be touched"); } },
  rules: { async listActive(): Promise<never> { throw new Error("rules must not be touched"); } },
  accounts: { async findById(): Promise<never> { throw new Error("accounts must not be touched"); } },
  dimensions: {
    async findPoliciesForAccount(): Promise<never> { throw new Error("dimensions must not be touched"); },
    async findTypesByCompanyId(): Promise<never> { throw new Error("dimensions must not be touched"); },
    async resolveMemberBySource(): Promise<never> { throw new Error("dimensions must not be touched"); },
    async findMembersByIds(): Promise<never> { throw new Error("dimensions must not be touched"); },
  },
  unitOfWork: { async run(): Promise<never> { throw new Error("uow must not be touched"); } },
});

test("Step 32 fulfillment policy rejects duplicate purchase line identities", () => {
  assert.throws(() => evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("automatic"),
    lines: [
      { purchaseLineId: "same", lineKind: "service", fulfillmentState: "not-required" },
      { purchaseLineId: "same", lineKind: "service", fulfillmentState: "not-required" },
    ],
  }), /lines\.purchaseLineId/u);
});

test("Step 32 blocked stock fulfillment stops orchestration before Posting dependencies", async () => {
  const eligibility = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("automatic"),
    lines: [{
      purchaseLineId: "stock-line",
      lineKind: "stock-product",
      fulfillmentState: "partially-received",
    }],
  });

  const result = await orchestrateSupplierInvoicePosting({
    ...baseInput,
    eligibility,
    postingMode: "automatic",
  }, untouchableDeps());

  assert.equal(result.status, "blocked");
  assert.equal(result.posting, null);
  assert.equal(result.journal, null);
});

test("Step 32 accountant approval stops orchestration before Journal generation", async () => {
  const eligibility = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("accountant-approval"),
    lines: [{
      purchaseLineId: "service-line",
      lineKind: "service",
      fulfillmentState: "not-required",
    }],
  });

  const result = await orchestrateSupplierInvoicePosting({
    ...baseInput,
    eligibility,
    postingMode: "accountant-approval",
  }, untouchableDeps());

  assert.equal(result.status, "awaiting-accountant-approval");
  assert.equal(result.replayed, false);
});

test("Step 32 automatic mode rejects an approval-only eligibility envelope", async () => {
  const eligibility = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("accountant-approval"),
    lines: [{
      purchaseLineId: "service-line",
      lineKind: "service",
      fulfillmentState: "not-required",
    }],
  });

  await assert.rejects(
    () => orchestrateSupplierInvoicePosting({
      ...baseInput,
      eligibility,
      postingMode: "automatic",
    }, untouchableDeps()),
    /eligibility_mismatch/u,
  );
});

test("Step 32 non-confirmed source remains blocked even for service lines", () => {
  for (const sourceStatus of ["returned", "corrected"] as const) {
    const eligibility = evaluateSupplierInvoiceAccountingEligibility({
      sourceStatus,
      policy: createPurchaseFulfillmentAccountingPolicy("automatic"),
      lines: [{
        purchaseLineId: "service-line",
        lineKind: "service",
        fulfillmentState: "not-required",
      }],
    });
    assert.equal(eligibility.status, "blocked");
    assert.equal(eligibility.reasonCode, "source_not_confirmed");
  }
});

test("Step 32 policy result objects remain immutable snapshots", () => {
  const eligibility = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("automatic"),
    lines: [{
      purchaseLineId: "service-line",
      lineKind: "service",
      fulfillmentState: "not-required",
    }],
  });
  assert.equal(Object.isFrozen(eligibility), true);
  assert.equal(Object.isFrozen(eligibility.lines), true);
  assert.equal(Object.isFrozen(eligibility.lines[0]), true);
});
