import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  applySalesPostingCompareAndSwap,
  createSalesPosting,
  createSalesPostingIdempotencyKey,
  createSalesPostingIdempotencyRecord,
  prepareSalesPostingMutation,
} from "../src/index.ts";

const source = {
  sourceSystem: "sales",
  sourceType: "sales-invoice",
  sourceDocumentId: "invoice-001",
  sourceVersion: 4,
  externalReference: null,
} as const;

function posting(version = 1) {
  const created = createSalesPosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source,
    createdAtUtc: "2026-10-07T10:00:00.000Z",
  });
  if (version === 1) return created;
  let current = created;
  for (let i = 1; i < version; i += 1) {
    current = applySalesPostingCompareAndSwap(current, {
      postingId: current.postingId,
      companyId: current.companyId,
      branchId: current.branchId,
      source: current.source,
      expectedPostingVersion: current.version,
    }, `2026-10-07T10:00:0${i}.000Z`);
  }
  return current;
}

test("CAS increments Sales Posting version exactly once", () => {
  const current = posting();
  const next = applySalesPostingCompareAndSwap(current, {
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source,
    expectedPostingVersion: 1,
  }, "2026-10-07T10:01:00.000Z");

  assert.equal(current.version, 1);
  assert.equal(next.version, 2);
  assert.equal(next.updatedAtUtc, "2026-10-07T10:01:00.000Z");
  assert.equal(next.source.sourceVersion, 4);
});

test("stale expected version conflicts before mutation proceeds", () => {
  const current = posting(2);

  assert.throws(
    () => applySalesPostingCompareAndSwap(current, {
      postingId: "posting-001",
      companyId: "company-001",
      branchId: "branch-001",
      source,
      expectedPostingVersion: 1,
    }, "2026-10-07T10:02:00.000Z"),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict
      && error.field === "expectedPostingVersion",
  );
});

test("CAS rejects wrong posting, scope and source identity", () => {
  const current = posting();

  for (const expectation of [
    {
      postingId: "posting-x",
      companyId: "company-001",
      branchId: "branch-001",
      source,
      expectedPostingVersion: 1,
    },
    {
      postingId: "posting-001",
      companyId: "company-x",
      branchId: "branch-001",
      source,
      expectedPostingVersion: 1,
    },
    {
      postingId: "posting-001",
      companyId: "company-001",
      branchId: "branch-x",
      source,
      expectedPostingVersion: 1,
    },
    {
      postingId: "posting-001",
      companyId: "company-001",
      branchId: "branch-001",
      source: { ...source, sourceVersion: 5 },
      expectedPostingVersion: 1,
    },
  ]) {
    assert.throws(
      () => applySalesPostingCompareAndSwap(
        current,
        expectation,
        "2026-10-07T10:02:00.000Z",
      ),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
    );
  }
});

test("CAS rejects timestamp regression", () => {
  const current = posting();

  assert.throws(
    () => applySalesPostingCompareAndSwap(current, {
      postingId: "posting-001",
      companyId: "company-001",
      branchId: "branch-001",
      source,
      expectedPostingVersion: 1,
    }, "2026-10-07T09:59:59.000Z"),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});

test("exact replay is resolved before stale-version CAS", async () => {
  const current = posting(3);
  const fingerprint = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const key = createSalesPostingIdempotencyKey(
    source,
    "accounting-recognition",
  );
  const stored = createSalesPostingIdempotencyRecord({
    idempotencyKey: key,
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: fingerprint,
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    committedPostingVersion: 2,
    committedAtUtc: "2026-10-07T10:01:00.000Z",
  });

  const decision = await prepareSalesPostingMutation({
    current,
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: fingerprint,
    expectation: {
      postingId: "posting-001",
      companyId: "company-001",
      branchId: "branch-001",
      source,
      expectedPostingVersion: 1,
    },
  }, {
    async findByKey() { return stored; },
  });

  assert.equal(decision.kind, "replay");
  if (decision.kind === "replay") {
    assert.equal(decision.record.journalVoucherId, "journal-001");
  }
});

test("new mutation still enforces expectedVersion after replay miss", async () => {
  const current = posting(2);

  await assert.rejects(
    () => prepareSalesPostingMutation({
      current,
      source,
      purpose: "accounting-recognition",
      payloadFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      expectation: {
        postingId: "posting-001",
        companyId: "company-001",
        branchId: "branch-001",
        source,
        expectedPostingVersion: 1,
      },
    }, {
      async findByKey() { return null; },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict,
  );
});
