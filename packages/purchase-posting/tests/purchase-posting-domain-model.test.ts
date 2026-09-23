import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePosting,
  rehydratePurchasePosting,
} from "../src/index.ts";

const createdAt = "2026-09-22T12:00:00.000Z";

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchasePostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a persistence-neutral draft Purchase Posting aggregate", () => {
  const posting = createPurchasePosting({
    postingId: "purchase-posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt,
  });

  assert.deepEqual(posting, {
    postingId: "purchase-posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    status: "draft",
    journalVoucherId: null,
    version: 1,
    createdAt,
    updatedAt: createdAt,
  });
  assert.ok(Object.isFrozen(posting));
});

test("normalizes durable identities and rejects missing identity", () => {
  const posting = createPurchasePosting({
    postingId: "  purchase-posting-002 ",
    companyId: " company-001 ",
    branchId: " branch-001 ",
    createdAt,
  });

  assert.equal(posting.postingId, "purchase-posting-002");
  assert.equal(posting.companyId, "company-001");
  assert.equal(posting.branchId, "branch-001");

  assertDomainError(
    () => createPurchasePosting({
      postingId: " ",
      companyId: "company-001",
      branchId: "branch-001",
      createdAt,
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.identityRequired,
    "postingId",
  );
});

test("rehydrates prepared and posted states without depending on SQLite identity", () => {
  const prepared = rehydratePurchasePosting({
    postingId: "purchase-posting-003",
    companyId: "company-001",
    branchId: "branch-001",
    status: "prepared",
    journalVoucherId: "journal-voucher-9001",
    version: 3,
    createdAt,
    updatedAt: "2026-09-22T12:10:00.000Z",
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.journalVoucherId, "journal-voucher-9001");

  const posted = rehydratePurchasePosting({
    ...prepared,
    status: "posted",
    version: 4,
    updatedAt: "2026-09-22T12:15:00.000Z",
  });
  assert.equal(posted.journalVoucherId, "journal-voucher-9001");
});

test("rejects prepared posting without a Journal link", () => {
  assertDomainError(
    () => rehydratePurchasePosting({
      postingId: "purchase-posting-prepared",
      companyId: "company-001",
      branchId: "branch-001",
      status: "prepared",
      journalVoucherId: null,
      version: 2,
      createdAt,
      updatedAt: "2026-09-22T12:05:00.000Z",
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid,
    "journalVoucherId",
  );
});

test("enforces journal linkage invariant for posting state", () => {
  assertDomainError(
    () => rehydratePurchasePosting({
      postingId: "purchase-posting-004",
      companyId: "company-001",
      branchId: "branch-001",
      status: "draft",
      journalVoucherId: "journal-voucher-invalid",
      version: 1,
      createdAt,
      updatedAt: createdAt,
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid,
    "journalVoucherId",
  );

  assertDomainError(
    () => rehydratePurchasePosting({
      postingId: "purchase-posting-005",
      companyId: "company-001",
      branchId: "branch-001",
      status: "posted",
      journalVoucherId: null,
      version: 2,
      createdAt,
      updatedAt: "2026-09-22T12:05:00.000Z",
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.stateInvalid,
    "journalVoucherId",
  );
});

test("rejects invalid version and timestamp chronology", () => {
  assertDomainError(
    () => rehydratePurchasePosting({
      postingId: "purchase-posting-006",
      companyId: "company-001",
      branchId: "branch-001",
      status: "draft",
      journalVoucherId: null,
      version: 0,
      createdAt,
      updatedAt: createdAt,
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid,
    "version",
  );

  assertDomainError(
    () => rehydratePurchasePosting({
      postingId: "purchase-posting-007",
      companyId: "company-001",
      branchId: "branch-001",
      status: "draft",
      journalVoucherId: null,
      version: 1,
      createdAt,
      updatedAt: "2026-09-22T11:59:59.000Z",
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampOrderInvalid,
    "updatedAt",
  );
});

test("rejects non-canonical UTC timestamps", () => {
  assertDomainError(
    () => createPurchasePosting({
      postingId: "purchase-posting-008",
      companyId: "company-001",
      branchId: "branch-001",
      createdAt: "2026-09-22T15:30:00+03:30",
    }),
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampInvalid,
    "createdAt",
  );
});
