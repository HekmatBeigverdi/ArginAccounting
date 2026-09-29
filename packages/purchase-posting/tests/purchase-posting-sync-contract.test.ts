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


test("Step 34 Bridge envelope survives JSON round-trip without losing financial identity", () => {
  const envelope = createPurchasePostingStateSyncEnvelope({
    ...metadata,
    serverRevision: 42,
    source,
    postingPurpose: "accounting-recognition",
    snapshot: preparedPosting(),
  });

  const wire = JSON.parse(JSON.stringify(envelope)) as typeof envelope;

  assert.equal(wire.contractVersion, 1);
  assert.equal(wire.schemaVersion, 1);
  assert.equal(wire.entity, "purchase-posting");
  assert.equal(wire.changeKind, "upsert");
  assert.equal(wire.postingId, "posting-001");
  assert.equal(wire.localVersion, 2);
  assert.equal(wire.serverRevision, 42);
  assert.equal(wire.source.sourceId, "invoice-001");
  assert.equal(wire.source.sourceVersion, 7);
  assert.equal(wire.source.sourceRevision, 2);
  assert.equal(wire.snapshot.journalVoucherId, "journal-001");
  assert.deepEqual(wire.dependencies, envelope.dependencies);
});

test("Step 34 server revision never replaces local optimistic version", () => {
  const envelope = createPurchasePostingStateSyncEnvelope({
    ...metadata,
    serverRevision: 999,
    source,
    postingPurpose: "accounting-recognition",
    snapshot: preparedPosting(),
  });

  assert.equal(envelope.localVersion, 2);
  assert.equal(envelope.serverRevision, 999);
  assert.notEqual(envelope.localVersion, envelope.serverRevision);
});

test("Step 34 financial Posting contract exposes upsert only and no tombstone state", () => {
  const postingEnvelope = createPurchasePostingStateSyncEnvelope({
    ...metadata,
    source,
    postingPurpose: "accounting-recognition",
    snapshot: preparedPosting(),
  });
  const reversalEnvelope = createPurchasePostingReversalSyncEnvelope({
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

  assert.equal(postingEnvelope.changeKind, "upsert");
  assert.equal(reversalEnvelope.changeKind, "upsert");
  assert.equal("deletedAt" in postingEnvelope, false);
  assert.equal("deletedAt" in reversalEnvelope, false);
});

test("Step 34 Bridge rejects cross-scope Purchase source for Posting snapshot", () => {
  assert.throws(
    () => createPurchasePostingStateSyncEnvelope({
      ...metadata,
      source: createPurchasePostingSourceIdentity({
        ...source,
        companyId: "company-other",
      }),
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

test("Step 34 reversal changedAt must cover immutable reversal chronology", () => {
  assert.throws(
    () => createPurchasePostingReversalSyncEnvelope({
      ...metadata,
      changedAt: "2026-09-24T06:04:59.000Z",
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
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingSyncContractError);
      assert.equal(error.code, "purchase-posting.sync.timestamp-invalid");
      return true;
    },
  );
});
