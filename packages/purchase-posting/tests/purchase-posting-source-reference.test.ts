import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  assertPurchasePostingLineReferenceMatchesFact,
  assertPurchasePostingSourceMatchesFact,
  createPurchasePostingFact,
  createPurchasePostingSourceIdentity,
  createPurchasePostingSourceLineReference,
  createPurchasePostingSourceReference,
  createPurchasePostingTraceContext,
  purchasePostingSourceIdentityKey,
} from "../src/index.ts";

const amounts = {
  currency: "IRR",
  grossAmount: 10_000,
  discountAmount: 1_000,
  netAfterDiscount: 9_000,
  chargeAmount: 100,
  taxBaseAmount: 9_100,
  taxAmount: 910,
  grandTotal: 10_010,
} as const;

function fact() {
  return createPurchasePostingFact({
    factId: "fact-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-1405-07",
    purchaseDocumentId: "purchase-doc-001",
    purchaseDocumentVersion: 7,
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
    documentNumber: "PINV-001",
    businessDate: "2026-09-22",
    supplier: {
      companyId: "company-001",
      supplierId: "supplier-001",
      code: "SUP-001",
      displayName: "تأمین کننده",
      nationalCode: null,
      nationalId: "10101234567",
      economicNumber: "411111111111",
      taxFileNumber: null,
    },
    lines: [{
      purchaseLineId: "purchase-line-001",
      position: 1,
      lineKind: "service",
      item: {
        itemId: "service-001",
        itemType: "service",
        code: "SRV-001",
        displayName: "خدمت",
        taxpayerGoodsServiceId: null,
        stockTracking: false,
      },
      baseQuantity: "1",
      amounts,
      valuations: [],
    }],
    totals: amounts,
    capturedAt: "2026-09-22T13:00:00.000Z",
  });
}

function source() {
  return createPurchasePostingSourceIdentity({
    companyId: "company-001",
    branchId: "branch-001",
    sourceType: "supplier-invoice",
    sourceId: "purchase-doc-001",
    sourceVersion: 7,
  });
}

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchasePostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a durable Purchase source identity independent of persistence row IDs", () => {
  const identity = source();
  assert.deepEqual(identity, {
    companyId: "company-001",
    branchId: "branch-001",
    sourceSystem: "purchase",
    sourceType: "supplier-invoice",
    sourceId: "purchase-doc-001",
    sourceVersion: 7,
    sourceRevision: null,
  });
  assert.ok(Object.isFrozen(identity));
});

test("preserves explicit source revision without treating it as aggregate version", () => {
  const identity = createPurchasePostingSourceIdentity({
    companyId: "company-001",
    branchId: "branch-001",
    sourceType: "purchase-correction",
    sourceId: "purchase-correction-001",
    sourceVersion: 3,
    sourceRevision: 2,
  });
  assert.equal(identity.sourceVersion, 3);
  assert.equal(identity.sourceRevision, 2);
});

test("creates trace context with independent request, operation, correlation and causation identities", () => {
  const trace = createPurchasePostingTraceContext({
    requestId: "request-001",
    operationId: "operation-002",
    correlationId: "purchase-flow-001",
    causationId: "operation-001",
  });
  assert.equal(trace.requestId, "request-001");
  assert.equal(trace.operationId, "operation-002");
  assert.equal(trace.correlationId, "purchase-flow-001");
  assert.equal(trace.causationId, "operation-001");
  assert.ok(Object.isFrozen(trace));
});

test("supports root operations with null causation and rejects self-causation", () => {
  const root = createPurchasePostingTraceContext({
    requestId: "request-root",
    operationId: "operation-root",
    correlationId: "flow-root",
  });
  assert.equal(root.causationId, null);

  assertDomainError(
    () => createPurchasePostingTraceContext({
      requestId: "request-1",
      operationId: "same-id",
      correlationId: "flow-1",
      causationId: "same-id",
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.selfCausation,
    "trace.causationId",
  );
});

test("builds a composed immutable source reference", () => {
  const reference = createPurchasePostingSourceReference({
    source: source(),
    trace: {
      requestId: "request-001",
      operationId: "operation-001",
      correlationId: "flow-001",
      causationId: null,
    },
  });
  assert.equal(reference.source.sourceSystem, "purchase");
  assert.equal(reference.trace.operationId, "operation-001");
  assert.ok(Object.isFrozen(reference));
});

test("validates source identity against the exact Purchase Posting Fact version and scope", () => {
  assert.doesNotThrow(() => assertPurchasePostingSourceMatchesFact(source(), fact()));

  assertDomainError(
    () => assertPurchasePostingSourceMatchesFact(
      { ...source(), sourceVersion: 6 },
      fact(),
    ),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch,
    "source.sourceVersion",
  );

  assertDomainError(
    () => assertPurchasePostingSourceMatchesFact(
      { ...source(), branchId: "other-branch" },
      fact(),
    ),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch,
    "source.branchId",
  );
});

test("validates line references against the captured Purchase line set", () => {
  const valid = createPurchasePostingSourceLineReference({
    source: source(),
    sourceLineId: "purchase-line-001",
  });
  assert.doesNotThrow(() => assertPurchasePostingLineReferenceMatchesFact(valid, fact()));

  assertDomainError(
    () => assertPurchasePostingLineReferenceMatchesFact(
      { ...valid, sourceLineId: "missing-line" },
      fact(),
    ),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceReferenceMismatch,
    "lineReference.sourceLineId",
  );
});

test("creates deterministic source identity keys without making them idempotency keys", () => {
  assert.equal(
    purchasePostingSourceIdentityKey(source()),
    "purchase:company-001:branch-001:supplier-invoice:purchase-doc-001:v7:r-",
  );
  assert.equal(
    purchasePostingSourceIdentityKey({
      ...source(),
      sourceRevision: 4,
    }),
    "purchase:company-001:branch-001:supplier-invoice:purchase-doc-001:v7:r4",
  );
});

test("rejects unsupported source systems and invalid versions", () => {
  assertDomainError(
    () => createPurchasePostingSourceIdentity({
      companyId: "company-001",
      branchId: "branch-001",
      sourceSystem: "purchase",
      sourceType: "supplier-invoice",
      sourceId: "purchase-doc-001",
      sourceVersion: 0,
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid,
    "source.sourceVersion",
  );
});


test("canonical source key escapes delimiter-bearing durable identities", () => {
  const identity = createPurchasePostingSourceIdentity({
    companyId: "company:01",
    branchId: "branch%01",
    sourceType: "supplier-invoice",
    sourceId: "invoice:2026/001",
    sourceVersion: 2,
  });
  assert.equal(
    purchasePostingSourceIdentityKey(identity),
    "purchase:company%3A01:branch%2501:supplier-invoice:invoice%3A2026%2F001:v2:r-",
  );
});

test("reports malformed trace identifiers as trace-context errors", () => {
  assertDomainError(
    () => createPurchasePostingTraceContext({
      requestId: "request-001",
      operationId: "operation-001",
      correlationId: "x".repeat(129),
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.traceContextInvalid,
    "trace.correlationId",
  );
});
