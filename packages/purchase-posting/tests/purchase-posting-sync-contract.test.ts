import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_SYNC_CONTRACT_VERSION,
  PURCHASE_POSTING_SYNC_SCHEMA_VERSION,
  PurchasePostingSyncContractError,
  createPurchasePosting,
  createPurchasePostingRule,
  createPurchasePostingSourceIdentity,
  createPurchasePostingStateSyncEnvelope,
  createPurchasePostingRuleSyncEnvelope,
  createPurchasePostingReversalSyncEnvelope,
  preparePurchasePosting,
} from "../src/index.ts";

const FP = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const metadata = {
  operationId: "operation-001",
  requestId: "request-001",
  correlationId: "correlation-001",
  causationId: null,
  payloadFingerprint: FP,
  occurredAt: "2026-09-24T06:00:00.000Z",
  effectiveAt: "2026-09-24T06:00:00.000Z",
  changedAt: "2026-09-24T06:10:00.000Z",
  origin: {
    sourceSystem: "argin-desktop",
    sourceInstanceId: "desktop-001",
  },
};

function preparedPosting() {
  const draft = createPurchasePosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    createdAt: "2026-09-24T06:00:00.000Z",
  });
  return preparePurchasePosting(draft, {
    journalVoucherId: "journal-001",
    expectedVersion: 1,
    occurredAt: "2026-09-24T06:05:00.000Z",
  });
}

const source = createPurchasePostingSourceIdentity({
  companyId: "company-001",
  branchId: "branch-001",
  sourceType: "supplier-invoice",
  sourceId: "invoice-001",
  sourceVersion: 7,
  sourceRevision: 2,
});

test("Posting Bridge envelope freezes versioned durable source and Journal dependencies", () => {
  const envelope = createPurchasePostingStateSyncEnvelope({
    ...metadata,
    source,
    postingPurpose: "accounting-recognition",
    snapshot: preparedPosting(),
  });

  assert.equal(envelope.contractVersion, PURCHASE_POSTING_SYNC_CONTRACT_VERSION);
  assert.equal(envelope.schemaVersion, PURCHASE_POSTING_SYNC_SCHEMA_VERSION);
  assert.equal(envelope.entity, "purchase-posting");
  assert.equal(envelope.localVersion, 2);
  assert.equal(envelope.source.sourceVersion, 7);
  assert.equal(envelope.source.sourceRevision, 2);
  assert.match(envelope.idempotencyKey, /purpose:accounting-recognition$/u);
  assert.deepEqual(envelope.dependencies, [
    { entity: "branch", id: "branch-001" },
    { entity: "journal-voucher", id: "journal-001" },
    { entity: "purchase-document", id: "invoice-001" },
  ]);
});

test("Posting Bridge rejects changedAt older than aggregate update", () => {
  assert.throws(
    () => createPurchasePostingStateSyncEnvelope({
      ...metadata,
      changedAt: "2026-09-24T06:01:00.000Z",
      source,
      postingPurpose: "accounting-recognition",
      snapshot: preparedPosting(),
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingSyncContractError);
      assert.equal(error.code, "purchase-posting.sync.snapshot-mismatch");
      return true;
    },
  );
});

test("Posting Rule envelope carries Account and optional Branch dependencies", () => {
  const rule = createPurchasePostingRule({
    ruleId: "rule-001",
    companyId: "company-001",
    branchId: "branch-001",
    eventKind: "supplier-invoice-recognition",
    lineKind: "stock-product",
    accountRole: "inventory-asset",
    accountId: "account-inventory",
    priority: 100,
    active: true,
  });

  const envelope = createPurchasePostingRuleSyncEnvelope({
    ...metadata,
    snapshot: {
      rule,
      version: 3,
      createdAt: "2026-09-20T06:00:00.000Z",
      updatedAt: "2026-09-24T06:05:00.000Z",
    },
  });

  assert.equal(envelope.entity, "purchase-posting-rule");
  assert.equal(envelope.localVersion, 3);
  assert.deepEqual(envelope.dependencies, [
    { entity: "account", id: "account-inventory" },
    { entity: "branch", id: "branch-001" },
  ]);
});

test("Reversal envelope is immutable revision 1 with Posting and both Journal dependencies", () => {
  const envelope = createPurchasePostingReversalSyncEnvelope({
    ...metadata,
    companyId: "company-001",
    snapshot: {
      postingId: "posting-001",
      originalJournalVoucherId: "journal-001",
      reversalJournalVoucherId: "journal-reversal-001",
      requestId: "reversal-request-001",
      reversedBy: "user-001",
      reversedAt: "2026-09-24T06:05:00.000Z",
      reason: "Controlled correction",
      committedPostingVersion: 5,
    },
  });

  assert.equal(envelope.entity, "purchase-posting-reversal");
  assert.equal(envelope.localRevision, 1);
  assert.deepEqual(envelope.dependencies, [
    { entity: "journal-voucher", id: "journal-001" },
    { entity: "journal-voucher", id: "journal-reversal-001" },
    { entity: "purchase-posting", id: "posting-001" },
  ]);
});

test("Bridge contract rejects invalid fingerprint and self-causation", () => {
  assert.throws(
    () => createPurchasePostingStateSyncEnvelope({
      ...metadata,
      payloadFingerprint: "bad",
      source,
      postingPurpose: "accounting-recognition",
      snapshot: preparedPosting(),
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingSyncContractError);
      assert.equal(error.code, "purchase-posting.sync.fingerprint-invalid");
      return true;
    },
  );

  assert.throws(
    () => createPurchasePostingStateSyncEnvelope({
      ...metadata,
      causationId: metadata.operationId,
      source,
      postingPurpose: "accounting-recognition",
      snapshot: preparedPosting(),
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingSyncContractError);
      assert.equal(error.code, "purchase-posting.sync.trace-invalid");
      return true;
    },
  );
});
