import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesPostingIdempotencyIdentity,
  createSalesPostingIdempotencyKey,
  createSalesPostingIdempotencyRecord,
  resolveSalesPostingJournalEffect,
} from "../src/index.ts";

const FP_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FP_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const source = {
  sourceSystem: "sales",
  sourceType: "sales-invoice",
  sourceDocumentId: "sales-invoice-001",
  sourceVersion: 7,
  externalReference: null,
} as const;

function memoryStore() {
  const records = new Map<string, any>();
  let saveCount = 0;
  return {
    store: {
      async findByKey(key:string) { return records.get(key) ?? null; },
      async save(record:any) {
        saveCount += 1;
        if (records.has(record.idempotencyKey)) {
          throw new Error("unique violation");
        }
        records.set(record.idempotencyKey, record);
      },
    },
    get saveCount() { return saveCount; },
    records,
  };
}

test("idempotency key is deterministic from source version and purpose", () => {
  const key = createSalesPostingIdempotencyKey(
    source,
    "accounting-recognition",
  );
  assert.equal(
    key,
    "sales:sales-invoice:sales-invoice-001:v7:purpose:accounting-recognition",
  );
});

test("first execution stores one business effect outcome", async () => {
  const memory = memoryStore();
  const result = await resolveSalesPostingJournalEffect({
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: FP_A,
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    committedPostingVersion: 2,
    committedAtUtc: "2026-10-07T10:00:00.000Z",
  }, memory.store);

  assert.equal(result.replayed, false);
  assert.equal(result.postingId, "posting-001");
  assert.equal(result.journalVoucherId, "journal-001");
  assert.equal(memory.saveCount, 1);
  assert.equal(memory.records.size, 1);
});

test("compatible retry replays stored outcome and does not save a second effect", async () => {
  const memory = memoryStore();
  const input = {
    source,
    purpose: "accounting-recognition" as const,
    payloadFingerprint: FP_A,
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    committedPostingVersion: 2,
    committedAtUtc: "2026-10-07T10:00:00.000Z",
  };

  const first = await resolveSalesPostingJournalEffect(input, memory.store);
  const replay = await resolveSalesPostingJournalEffect({
    ...input,
    postingId: "would-be-duplicate-posting",
    journalVoucherId: "would-be-duplicate-journal",
  }, memory.store);

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.postingId, "posting-001");
  assert.equal(replay.journalVoucherId, "journal-001");
  assert.equal(memory.saveCount, 1);
  assert.equal(memory.records.size, 1);
});

test("same business identity with incompatible payload fingerprint conflicts", async () => {
  const memory = memoryStore();

  await resolveSalesPostingJournalEffect({
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: FP_A,
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    committedPostingVersion: 2,
    committedAtUtc: "2026-10-07T10:00:00.000Z",
  }, memory.store);

  await assert.rejects(
    () => resolveSalesPostingJournalEffect({
      source,
      purpose: "accounting-recognition",
      payloadFingerprint: FP_B,
      postingId: "posting-002",
      journalVoucherId: "journal-002",
      committedPostingVersion: 2,
      committedAtUtc: "2026-10-07T10:01:00.000Z",
    }, memory.store),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict
      && error.field === "payloadFingerprint",
  );
});

test("new source version creates a distinct business effect identity", async () => {
  const memory = memoryStore();

  for (const version of [7, 8]) {
    await resolveSalesPostingJournalEffect({
      source: { ...source, sourceVersion: version },
      purpose: "accounting-recognition",
      payloadFingerprint: FP_A,
      postingId: `posting-${version}`,
      journalVoucherId: `journal-${version}`,
      committedPostingVersion: 2,
      committedAtUtc: "2026-10-07T10:00:00.000Z",
    }, memory.store);
  }

  assert.equal(memory.records.size, 2);
});

test("rejects malformed fingerprint and malformed replay outcome", () => {
  assert.throws(
    () => createSalesPostingIdempotencyIdentity({
      source,
      purpose: "accounting-recognition",
      payloadFingerprint: "not-a-sha256",
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid,
  );

  const identity = createSalesPostingIdempotencyIdentity({
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: FP_A,
  });
  const key = createSalesPostingIdempotencyKey(
    identity.source,
    identity.purpose,
  );

  assert.throws(
    () => createSalesPostingIdempotencyRecord({
      idempotencyKey: key,
      source,
      purpose: "accounting-recognition",
      payloadFingerprint: FP_A,
      postingId: "",
      journalVoucherId: "journal-001",
      committedPostingVersion: 2,
      committedAtUtc: "2026-10-07T10:00:00.000Z",
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
  );
});

test("idempotency record preserves exact committed outcome for restart replay", () => {
  const identity = createSalesPostingIdempotencyIdentity({
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: FP_A,
  });
  const record = createSalesPostingIdempotencyRecord({
    idempotencyKey: createSalesPostingIdempotencyKey(
      identity.source,
      identity.purpose,
    ),
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: FP_A,
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    committedPostingVersion: 2,
    committedAtUtc: "2026-10-07T10:00:00.000Z",
  });

  assert.equal(record.postingId, "posting-001");
  assert.equal(record.journalVoucherId, "journal-001");
  assert.equal(record.committedPostingVersion, 2);
});
