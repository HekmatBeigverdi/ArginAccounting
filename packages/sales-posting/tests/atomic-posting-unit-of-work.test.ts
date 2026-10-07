import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  commitSalesPostingAccountingEffectAtomic,
  createSalesPosting,
} from "../src/index.ts";

const source = {
  sourceSystem: "sales",
  sourceType: "sales-invoice",
  sourceDocumentId: "invoice-001",
  sourceVersion: 3,
  externalReference: null,
} as const;

function currentPosting() {
  return createSalesPosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source,
    createdAtUtc: "2026-10-07T10:00:00.000Z",
  });
}

function memoryUow(options?: { casResult?: boolean; failOutbox?: boolean }) {
  let posting = currentPosting();
  const idempotency = new Map<string, any>();
  const outbox:any[] = [];
  let committed = false;

  const unitOfWork = {
    async run<T>(work:(session:any)=>Promise<T>):Promise<T> {
      const postingSnapshot = posting;
      const idempotencySnapshot = new Map(idempotency);
      const outboxSnapshot = [...outbox];
      try {
        const result = await work({
          async findIdempotencyRecord(key:string) {
            return idempotency.get(key) ?? null;
          },
          async findPosting(id:string) {
            return posting.postingId === id ? posting : null;
          },
          async savePostingCas(next:any, expectedVersion:number) {
            if (options?.casResult === false) return false;
            if (posting.version !== expectedVersion) return false;
            posting = next;
            return true;
          },
          async saveIdempotencyRecord(record:any) {
            if (idempotency.has(record.idempotencyKey)) {
              throw new Error("unique idempotency violation");
            }
            idempotency.set(record.idempotencyKey, record);
          },
          async appendOutboxEvent(event:any) {
            if (options?.failOutbox) throw new Error("outbox failed");
            outbox.push(event);
          },
        });
        committed = true;
        return result;
      } catch (error) {
        posting = postingSnapshot;
        idempotency.clear();
        for (const [key,value] of idempotencySnapshot) idempotency.set(key,value);
        outbox.splice(0,outbox.length,...outboxSnapshot);
        throw error;
      }
    },
  };

  return {
    unitOfWork,
    get posting(){return posting;},
    idempotency,
    outbox,
    get committed(){return committed;},
  };
}

function input() {
  return {
    posting: currentPosting(),
    source,
    purpose: "accounting-recognition" as const,
    payloadFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    journalVoucherId: "journal-001",
    expectedPostingVersion: 1,
    occurredAtUtc: "2026-10-07T10:01:00.000Z",
    outboxEventId: "outbox-001",
  };
}

test("atomically saves CAS posting, idempotency record and outbox event", async () => {
  const memory = memoryUow();
  const result = await commitSalesPostingAccountingEffectAtomic(
    input(),
    memory.unitOfWork,
  );

  assert.equal(result.replayed, false);
  assert.equal(result.posting.version, 2);
  assert.equal(memory.posting.version, 2);
  assert.equal(memory.idempotency.size, 1);
  assert.equal(memory.outbox.length, 1);
  assert.equal(
    memory.outbox[0].eventType,
    "sales-posting.accounting-recognition.committed",
  );
  assert.equal(memory.outbox[0].journalVoucherId, "journal-001");
});

test("CAS zero-row result becomes atomic commit conflict", async () => {
  const memory = memoryUow({ casResult: false });

  await assert.rejects(
    () => commitSalesPostingAccountingEffectAtomic(input(), memory.unitOfWork),
    (error:unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.atomicCommitConflict,
  );

  assert.equal(memory.posting.version, 1);
  assert.equal(memory.idempotency.size, 0);
  assert.equal(memory.outbox.length, 0);
});

test("outbox failure rolls back posting and idempotency in the UoW", async () => {
  const memory = memoryUow({ failOutbox: true });

  await assert.rejects(
    () => commitSalesPostingAccountingEffectAtomic(input(), memory.unitOfWork),
  );

  assert.equal(memory.posting.version, 1);
  assert.equal(memory.idempotency.size, 0);
  assert.equal(memory.outbox.length, 0);
});

test("compatible replay returns stored outcome without second CAS or outbox", async () => {
  const memory = memoryUow();
  const first = await commitSalesPostingAccountingEffectAtomic(
    input(),
    memory.unitOfWork,
  );
  const second = await commitSalesPostingAccountingEffectAtomic(
    {
      ...input(),
      expectedPostingVersion: 1,
      outboxEventId: "outbox-duplicate",
    },
    memory.unitOfWork,
  );

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(memory.posting.version, 2);
  assert.equal(memory.idempotency.size, 1);
  assert.equal(memory.outbox.length, 1);
});

test("incompatible replay fingerprint conflicts without side effects", async () => {
  const memory = memoryUow();
  await commitSalesPostingAccountingEffectAtomic(input(), memory.unitOfWork);

  await assert.rejects(
    () => commitSalesPostingAccountingEffectAtomic({
      ...input(),
      payloadFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    }, memory.unitOfWork),
    (error:unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyConflict,
  );

  assert.equal(memory.posting.version, 2);
  assert.equal(memory.idempotency.size, 1);
  assert.equal(memory.outbox.length, 1);
});

test("outbox event preserves durable source/posting/journal provenance", async () => {
  const memory = memoryUow();
  const result = await commitSalesPostingAccountingEffectAtomic(
    input(),
    memory.unitOfWork,
  );

  assert.equal(result.outboxEvent?.aggregateId, "posting-001");
  assert.equal(result.outboxEvent?.companyId, "company-001");
  assert.equal(result.outboxEvent?.sourceDocumentId, "invoice-001");
  assert.equal(result.outboxEvent?.sourceVersion, 3);
  assert.equal(result.outboxEvent?.postingVersion, 2);
  assert.equal(result.outboxEvent?.journalVoucherId, "journal-001");
});
