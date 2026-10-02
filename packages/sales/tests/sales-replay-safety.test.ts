import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesIdempotencyRecord,
  createSalesMutationContext,
  decideSalesReplay,
  replaySalesResult,
  type SalesIdempotencyRecord,
} from "../src/index.ts";

const context = (overrides: Partial<ReturnType<typeof createSalesMutationContext>> = {}) =>
  createSalesMutationContext({
    companyId: "co-1",
    branchId: "br-1",
    requestId: "req-1",
    operationId: "op-1",
    operation: "sales-invoice:create",
    payloadFingerprint: "sha256:payload-a",
    actorUserId: "user-1",
    occurredAt: "2026-10-02T09:00:00+03:30",
    ...overrides,
  });

const record = () =>
  createSalesIdempotencyRecord({
    context: context(),
    outcomeKind: "sales-document",
    outcomeId: "inv-1",
    outcomeVersion: 1,
    outcomeStatus: "draft",
    resultJson: JSON.stringify({ documentId: "inv-1", status: "draft", version: 1 }),
    recordedAt: "2026-10-02T09:00:01+03:30",
  });

function reader(records: readonly SalesIdempotencyRecord[]) {
  return {
    async findByRequestId(companyId: string, requestId: string) {
      return records.find((x) => x.companyId === companyId && x.requestId === requestId) ?? null;
    },
    async findByOperationId(companyId: string, operationId: string) {
      return records.find((x) => x.companyId === companyId && x.operationId === operationId) ?? null;
    },
  };
}

test("new mutation identity executes", async () => {
  const result = await decideSalesReplay(reader([]), context());
  assert.equal(result.kind, "execute");
});

test("exact retry replays the exact committed outcome", async () => {
  const stored = record();
  const decision = await decideSalesReplay(reader([stored]), context());
  assert.equal(decision.kind, "replay");
  if (decision.kind === "replay") {
    assert.deepEqual(replaySalesResult(decision.record), { documentId: "inv-1", status: "draft", version: 1 });
  }
});

test("same request and operation identity with changed payload conflicts", async () => {
  const stored = record();
  await assert.rejects(
    () => decideSalesReplay(reader([stored]), context({ payloadFingerprint: "sha256:payload-b" })),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.idempotency_conflict",
  );
});

test("same request id reused by a different operation id conflicts", async () => {
  const stored = record();
  await assert.rejects(
    () => decideSalesReplay(reader([stored]), context({ operationId: "op-2" })),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.idempotency_conflict",
  );
});

test("same operation id reused by a different request id conflicts", async () => {
  const stored = record();
  await assert.rejects(
    () => decideSalesReplay(reader([stored]), context({ requestId: "req-2" })),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.idempotency_conflict",
  );
});

test("crossed request and operation identities from different committed records conflict", async () => {
  const first = record();
  const secondContext = context({ requestId: "req-2", operationId: "op-2" });
  const second = createSalesIdempotencyRecord({
    context: secondContext,
    outcomeKind: "sales-document",
    outcomeId: "inv-2",
    resultJson: JSON.stringify({ documentId: "inv-2" }),
    recordedAt: "2026-10-02T09:01:00+03:30",
  });
  await assert.rejects(
    () => decideSalesReplay(reader([first, second]), context({ operationId: "op-2" })),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.idempotency_conflict",
  );
});

test("result envelope must be valid JSON and context timestamp is canonical UTC", () => {
  assert.equal(context().occurredAt, "2026-10-02T05:30:00.000Z");
  assert.throws(
    () => createSalesIdempotencyRecord({
      context: context(),
      outcomeKind: "sales-document",
      outcomeId: "inv-1",
      resultJson: "{bad",
      recordedAt: "2026-10-02T09:00:01+03:30",
    }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.idempotency_result_invalid",
  );
});
