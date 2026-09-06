import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import type { WarehouseAuditEvent } from "@argin/warehouse";

import { createPersistentWarehouseAuditSink } from "../src/pages/warehouse/warehouse-audit-sink.ts";

const baseEvent = {
  actorId: "user-1",
  companyId: "company-1",
  warehouseId: "warehouse-1",
  correlationId: "correlation-1",
  requestId: "request-1",
  occurredAt: "2026-09-05T10:00:00.000Z",
  metadata: { code: "W-1" },
} as const;

function createDatabase(execute: DatabaseExecutor["execute"]): DatabaseExecutor {
  return {
    execute,
    async query() { throw new Error("Unexpected audit query"); },
    async queryOne() { throw new Error("Unexpected audit query"); },
    async transaction() { throw new Error("Unexpected audit transaction"); },
    async close() {},
  };
}

for (const [action, childEntityId] of [
  ["warehouse.create", null],
  ["warehouse.zone.create", "zone-1"],
  ["warehouse.location.create", "location-1"],
] as const) {
  test(`${action} persists its audit entry without a pooled SQL transaction`, async () => {
    const writes: (readonly DatabaseValue[])[] = [];
    const database = createDatabase(async (sql, parameters = []) => {
      // A manual transaction on a pooled connection can lock subsequent writes.
      assert.doesNotMatch(sql, /\b(?:BEGIN|COMMIT|ROLLBACK)\b/iu);
      assert.match(sql, /INSERT INTO audit_entries/u);
      writes.push(parameters);
      return { rowsAffected: 1 };
    });
    const event: WarehouseAuditEvent = { ...baseEvent, action, childEntityId };

    await createPersistentWarehouseAuditSink(database).record(event);

    assert.equal(writes.length, 1);
    const row = writes[0];
    assert.equal(row[2], "create");
    assert.equal(row[6], baseEvent.actorId);
    assert.equal(row[8], baseEvent.companyId);
    assert.equal(row[11], childEntityId ? "warehouse-location-structure" : "warehouse");
    assert.equal(row[12], childEntityId ?? baseEvent.warehouseId);
    assert.equal(row[18], baseEvent.correlationId);
    assert.deepEqual(JSON.parse(String(row[19])), {
      ...baseEvent.metadata,
      warehouseAction: action,
      warehouseId: baseEvent.warehouseId,
      childEntityId,
      requestId: baseEvent.requestId,
    });
  });
}

test("warehouse audit still reports persistence failures", async () => {
  const failure = new Error("audit insert failed");
  const database = createDatabase(async () => { throw failure; });

  await assert.rejects(
    createPersistentWarehouseAuditSink(database).record({
      ...baseEvent,
      action: "warehouse.create",
      childEntityId: null,
    }),
    (error) => error === failure,
  );
});

test("warehouse restoration persists a status-change audit entry with its specific action", async () => {
  const writes: (readonly DatabaseValue[])[] = [];
  const database = createDatabase(async (_sql, parameters = []) => {
    writes.push(parameters);
    return { rowsAffected: 1 };
  });
  await createPersistentWarehouseAuditSink(database).record({
    ...baseEvent,
    action: "warehouse.restore",
    childEntityId: null,
    metadata: { previousStatus: "archived", status: "inactive", version: 3 },
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.[2], "status-change");
  const metadata = JSON.parse(String(writes[0]?.[19]));
  assert.equal(metadata.warehouseAction, "warehouse.restore");
  assert.equal(metadata.previousStatus, "archived");
  assert.equal(metadata.status, "inactive");
});
