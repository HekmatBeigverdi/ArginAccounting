import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesPosting,
  createSalesPostingSourceIdentity,
  rehydrateSalesPosting,
  salesPostingSourceIdentityKey,
} from "../src/index.ts";

const createdAtUtc = "2026-10-06T09:00:00.000Z";

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof SalesPostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a persistence-neutral Sales Posting aggregate with durable identity", () => {
  const posting = createSalesPosting({
    postingId: "sales-posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source: {
      sourceType: "sales-invoice",
      sourceDocumentId: "sales-invoice-001",
      sourceVersion: 4,
      externalReference: "desktop:invoice:001",
    },
    createdAtUtc,
  });

  assert.deepEqual(posting, {
    postingId: "sales-posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source: {
      sourceSystem: "sales",
      sourceType: "sales-invoice",
      sourceDocumentId: "sales-invoice-001",
      sourceVersion: 4,
      externalReference: "desktop:invoice:001",
    },
    version: 1,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
  });
  assert.ok(Object.isFrozen(posting));
  assert.ok(Object.isFrozen(posting.source));
});

test("normalizes durable identities without using document numbers as identity", () => {
  const posting = createSalesPosting({
    postingId: "  sales-posting-002  ",
    companyId: " company-001 ",
    branchId: " branch-001 ",
    source: {
      sourceType: "sales-return",
      sourceDocumentId: " return-id-002 ",
      sourceVersion: 2,
    },
    createdAtUtc,
  });

  assert.equal(posting.postingId, "sales-posting-002");
  assert.equal(posting.companyId, "company-001");
  assert.equal(posting.branchId, "branch-001");
  assert.equal(posting.source.sourceDocumentId, "return-id-002");
  assert.equal(posting.source.externalReference, null);
});

test("supports only authoritative Sales posting source document kinds", () => {
  const invoice = createSalesPostingSourceIdentity({
    sourceType: "sales-invoice",
    sourceDocumentId: "invoice-1",
    sourceVersion: 1,
  });
  const salesReturn = createSalesPostingSourceIdentity({
    sourceType: "sales-return",
    sourceDocumentId: "return-1",
    sourceVersion: 1,
  });
  const correction = createSalesPostingSourceIdentity({
    sourceType: "sales-correction",
    sourceDocumentId: "correction-1",
    sourceVersion: 1,
  });

  assert.equal(invoice.sourceType, "sales-invoice");
  assert.equal(salesReturn.sourceType, "sales-return");
  assert.equal(correction.sourceType, "sales-correction");

  assertDomainError(
    () => createSalesPostingSourceIdentity({
      sourceType: "sales-order" as "sales-invoice",
      sourceDocumentId: "order-1",
      sourceVersion: 1,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.sourceTypeInvalid,
    "source.sourceType",
  );
});

test("builds a deterministic source identity key without mutable display metadata", () => {
  const source = createSalesPostingSourceIdentity({
    sourceType: "sales-invoice",
    sourceDocumentId: "invoice/with spaces",
    sourceVersion: 7,
    externalReference: "bridge-display-reference",
  });

  assert.equal(
    salesPostingSourceIdentityKey(source),
    "sales:sales-invoice:invoice%2Fwith%20spaces:v7",
  );
});

test("rehydrates independently from SQLite or server persistence identities", () => {
  const posting = rehydrateSalesPosting({
    postingId: "sales-posting-003",
    companyId: "company-001",
    branchId: "branch-001",
    source: {
      sourceType: "sales-correction",
      sourceDocumentId: "correction-003",
      sourceVersion: 3,
      externalReference: "remote:correction:003",
    },
    version: 5,
    createdAtUtc,
    updatedAtUtc: "2026-10-06T09:05:00.000Z",
  });

  assert.equal(posting.version, 5);
  assert.equal(posting.source.sourceVersion, 3);
  assert.equal(posting.source.externalReference, "remote:correction:003");
});

test("rejects missing durable posting and source identities", () => {
  assertDomainError(
    () => createSalesPosting({
      postingId: " ",
      companyId: "company-001",
      branchId: "branch-001",
      source: {
        sourceType: "sales-invoice",
        sourceDocumentId: "invoice-1",
        sourceVersion: 1,
      },
      createdAtUtc,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired,
    "postingId",
  );

  assertDomainError(
    () => createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: " ",
      sourceVersion: 1,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired,
    "source.sourceDocumentId",
  );
});

test("rejects invalid versions and non-canonical UTC timestamps", () => {
  assertDomainError(
    () => createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: "invoice-1",
      sourceVersion: 0,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.versionInvalid,
    "source.sourceVersion",
  );

  assertDomainError(
    () => createSalesPosting({
      postingId: "sales-posting-004",
      companyId: "company-001",
      branchId: "branch-001",
      source: {
        sourceType: "sales-invoice",
        sourceDocumentId: "invoice-004",
        sourceVersion: 1,
      },
      createdAtUtc: "2026-10-06T12:30:00+03:30",
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.timestampInvalid,
    "createdAtUtc",
  );
});

test("rejects invalid aggregate version and backwards update time", () => {
  assertDomainError(
    () => rehydrateSalesPosting({
      postingId: "sales-posting-005",
      companyId: "company-001",
      branchId: "branch-001",
      source: {
        sourceType: "sales-invoice",
        sourceDocumentId: "invoice-005",
        sourceVersion: 1,
      },
      version: 0,
      createdAtUtc,
      updatedAtUtc: createdAtUtc,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.versionInvalid,
    "version",
  );

  assertDomainError(
    () => rehydrateSalesPosting({
      postingId: "sales-posting-006",
      companyId: "company-001",
      branchId: "branch-001",
      source: {
        sourceType: "sales-invoice",
        sourceDocumentId: "invoice-006",
        sourceVersion: 1,
      },
      version: 1,
      createdAtUtc,
      updatedAtUtc: "2026-10-06T08:59:59.000Z",
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid,
    "updatedAtUtc",
  );
});
