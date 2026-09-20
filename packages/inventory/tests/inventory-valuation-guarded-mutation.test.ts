import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryValuationConcurrencyError,
  executeInventoryValuationGuardedMutation,
  type InventoryValuationIdempotencyRecord,
  type InventoryValuationTransactionalContext,
  type InventoryValuationTransactionalUnitOfWork,
} from "../src/application/contracts/inventory-valuation-concurrency.ts";

function context(input?: { existing?: InventoryValuationIdempotencyRecord | null; nextRevision?: number }) {
  const events: string[] = [];
  const records: InventoryValuationIdempotencyRecord[] = [];
  const ctx = {
    idempotency: {
      async find() {
        events.push("idempotency.find");
        return input?.existing ?? null;
      },
      async add(record: InventoryValuationIdempotencyRecord) {
        events.push("idempotency.add");
        records.push(record);
      },
    },
    streamVersions: {
      async get() { return null; },
      async advance(companyId: string, streamKey: string, expectedRevision: number) {
        events.push(`stream.advance:${expectedRevision}`);
        return { companyId, streamKey, revision: input?.nextRevision ?? expectedRevision + 1 };
      },
    },
    entries: {}, policies: {}, layers: {}, states: {}, movements: {}, costInputs: {},
  } as unknown as InventoryValuationTransactionalContext;
  const unitOfWork: InventoryValuationTransactionalUnitOfWork = {
    async execute<T>(work: (value: InventoryValuationTransactionalContext) => Promise<T>): Promise<T> {
      events.push("uow.begin");
      try {
        const result = await work(ctx);
        events.push("uow.commit");
        return result;
      } catch (error) {
        events.push("uow.rollback");
        throw error;
      }
    },
  };
  return { ctx, unitOfWork, events, records };
}

const base = {
  companyId: "company-1",
  requestId: "request-1",
  operation: "resolve-movement",
  payloadFingerprint: "sha256:abc",
  streamKey: "valuation:company-1:product-1",
  expectedRevision: 3,
  outcomeKind: "valuation" as const,
  recordedAt: "2026-09-13T21:00:00+03:30",
};

test("guarded mutation executes replay lookup, CAS, mutation and durable outcome in one UoW", async () => {
  const fake = context({ nextRevision: 4 });
  let mutationCalls = 0;
  const result = await executeInventoryValuationGuardedMutation({
    ...base,
    unitOfWork: fake.unitOfWork,
    async mutate(_ctx, nextRevision) {
      mutationCalls++;
      fake.events.push(`mutate:${nextRevision}`);
      return { value: { entryId: "entry-1" }, outcomeId: "entry-1", outcomeRevision: nextRevision };
    },
  });

  assert.equal(result.kind, "committed");
  assert.equal(mutationCalls, 1);
  assert.deepEqual(fake.events, [
    "uow.begin",
    "idempotency.find",
    "stream.advance:3",
    "mutate:4",
    "idempotency.add",
    "uow.commit",
  ]);
  assert.equal(fake.records.length, 1);
  assert.deepEqual(fake.records[0], {
    companyId: "company-1",
    requestId: "request-1",
    operation: "resolve-movement",
    payloadFingerprint: "sha256:abc",
    outcomeKind: "valuation",
    outcomeId: "entry-1",
    outcomeRevision: 4,
    recordedAt: "2026-09-13T17:30:00.000Z",
  });
});

test("exact retry returns durable outcome without advancing stream or invoking mutation", async () => {
  const existing: InventoryValuationIdempotencyRecord = {
    companyId: "company-1",
    requestId: "request-1",
    operation: "resolve-movement",
    payloadFingerprint: "sha256:abc",
    outcomeKind: "valuation",
    outcomeId: "entry-1",
    outcomeRevision: 4,
    recordedAt: "2026-09-13T17:30:00.000Z",
  };
  const fake = context({ existing });
  let mutationCalls = 0;
  const result = await executeInventoryValuationGuardedMutation({
    ...base,
    unitOfWork: fake.unitOfWork,
    async mutate() {
      mutationCalls++;
      return { value: null, outcomeId: "should-not-run", outcomeRevision: null };
    },
  });

  assert.equal(result.kind, "replay");
  assert.equal(mutationCalls, 0);
  assert.deepEqual(fake.events, ["uow.begin", "idempotency.find", "uow.commit"]);
  assert.equal(fake.records.length, 0);
});

test("request-id reuse with a changed fingerprint conflicts before CAS or mutation", async () => {
  const existing: InventoryValuationIdempotencyRecord = {
    companyId: "company-1",
    requestId: "request-1",
    operation: "resolve-movement",
    payloadFingerprint: "sha256:old",
    outcomeKind: "valuation",
    outcomeId: "entry-1",
    outcomeRevision: 4,
    recordedAt: "2026-09-13T17:30:00.000Z",
  };
  const fake = context({ existing });
  let mutationCalls = 0;

  await assert.rejects(
    executeInventoryValuationGuardedMutation({
      ...base,
      unitOfWork: fake.unitOfWork,
      async mutate() {
        mutationCalls++;
        return { value: null, outcomeId: "never", outcomeRevision: null };
      },
    }),
    (error: unknown) => error instanceof InventoryValuationConcurrencyError && error.code === "VALUATION_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(mutationCalls, 0);
  assert.deepEqual(fake.events, ["uow.begin", "idempotency.find", "uow.rollback"]);
});

test("mutation failure never records a successful idempotency outcome", async () => {
  const fake = context({ nextRevision: 1 });
  await assert.rejects(
    executeInventoryValuationGuardedMutation({
      ...base,
      expectedRevision: 0,
      unitOfWork: fake.unitOfWork,
      async mutate(_ctx, nextRevision) {
        fake.events.push(`mutate:${nextRevision}`);
        throw new Error("valuation failed");
      },
    }),
    /valuation failed/u,
  );
  assert.deepEqual(fake.events, [
    "uow.begin",
    "idempotency.find",
    "stream.advance:0",
    "mutate:1",
    "uow.rollback",
  ]);
  assert.equal(fake.records.length, 0);
});
