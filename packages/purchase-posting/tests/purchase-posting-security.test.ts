import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "@argin/accounting/journal";

import {
  SecuredPurchasePostingService,
  PurchasePostingSecurityError,
  createPurchasePosting,
  createPurchasePostingSourceIdentity,
  createPurchasePostingTraceContext,
  purchasePostingAuditIdentity,
  purchasePostingPermissions,
  type PurchasePostingAuditEvent,
} from "../src/index.ts";

const FP = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function posting() {
  return createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-24T07:00:00.000Z",
  });
}

const source = createPurchasePostingSourceIdentity({
  companyId: "company-001",
  branchId: "branch-001",
  sourceType: "supplier-invoice",
  sourceId: "invoice-001",
  sourceVersion: 1,
  sourceRevision: null,
});

const trace = createPurchasePostingTraceContext({
  requestId: "request-001",
  operationId: "operation-001",
  correlationId: "correlation-001",
  causationId: null,
});

function journal() {
  return createJournalVoucher({
    id: "journal-001",
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
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      causationId: trace.causationId,
    },
    lines: [
      { id: "l1", order: 1, accountId: "a", debit: 100, credit: 0 },
      { id: "l2", order: 2, accountId: "b", debit: 0, credit: 100 },
    ],
    createdAt: "2026-09-24T07:00:00.000Z",
  });
}

test("authorization uses persisted Posting company and branch", async () => {
  const required: string[] = [];
  const service = new SecuredPurchasePostingService({
    postings: { async findById() { return posting(); } },
    authorization: {
      async require(context, permission) {
        assert.equal(context.companyId, "company-001");
        assert.equal(context.branchId, "branch-001");
        required.push(permission);
      },
    },
    audit: { async record() {} },
    postingUnitOfWork: {
      async run() { throw new Error("stop-after-auth"); },
    },
    reversalUnitOfWork: {
      async run() { throw new Error("unused"); },
    },
    traceReader: { async findByPostingId() { return null; } },
  });

  await assert.rejects(() => service.post(
    { actorId: "user-001" },
    {
      trace,
      command: {
        posting: posting(),
        journal: journal(),
        source,
        purpose: "accounting-recognition",
        payloadFingerprint: FP,
        expectedPostingVersion: 1,
        occurredAt: "2026-09-24T07:05:00.000Z",
      },
    },
  ), /stop-after-auth/u);

  assert.deepEqual(required, [purchasePostingPermissions.execute]);
});

test("trace mismatch is rejected before authorization", async () => {
  let authorized = false;
  const service = new SecuredPurchasePostingService({
    postings: { async findById() { return posting(); } },
    authorization: { async require() { authorized = true; } },
    audit: { async record() {} },
    postingUnitOfWork: { async run() { throw new Error("unused"); } },
    reversalUnitOfWork: { async run() { throw new Error("unused"); } },
    traceReader: { async findByPostingId() { return null; } },
  });

  await assert.rejects(
    () => service.post(
      { actorId: "user-001" },
      {
        trace: createPurchasePostingTraceContext({
          requestId: "request-other",
          operationId: "operation-001",
          correlationId: "correlation-001",
        }),
        command: {
          posting: posting(),
          journal: journal(),
          source,
          purpose: "accounting-recognition",
          payloadFingerprint: FP,
          expectedPostingVersion: 1,
          occurredAt: "2026-09-24T07:05:00.000Z",
        },
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingSecurityError);
      assert.equal(error.code, "PURCHASE_POSTING_TRACE_MISMATCH");
      return true;
    },
  );
  assert.equal(authorized, false);
});

test("deterministic audit identity uses action operation and durable target", () => {
  const event = {
    action: "purchase-posting.prepare",
    actorId: "user-001",
    companyId: "company-001",
    branchId: "branch-001",
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    reversalJournalVoucherId: null,
    requestId: "request-001",
    operationId: "operation-001",
    correlationId: "correlation-001",
    causationId: null,
    occurredAt: "2026-09-24T07:05:00.000Z",
    source,
    beforeStatus: "draft",
    afterStatus: "prepared",
    beforeVersion: 1,
    afterVersion: 2,
    reason: null,
    metadata: {},
  } satisfies PurchasePostingAuditEvent;

  assert.equal(
    purchasePostingAuditIdentity(event),
    "purchase-posting:purchase-posting.prepare:operation-001:posting-001",
  );
});
