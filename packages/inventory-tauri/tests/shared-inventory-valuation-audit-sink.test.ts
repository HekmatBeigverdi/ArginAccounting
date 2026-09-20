import assert from "node:assert/strict";
import test from "node:test";
import type { AuditCommandContext, AuditEntry, AuditRepository } from "@argin/audit";
import type { InventoryValuationAuditEvent } from "@argin/inventory/valuation-security";
import { SharedInventoryValuationAuditSink } from "../src/shared-inventory-valuation-audit-sink.ts";

function setup() {
  const entries: AuditEntry[] = [];
  const auditRepository: AuditRepository = {
    async create(entry) { entries.push(entry); },
    async findById(id) { return entries.find(entry => entry.id === id) ?? null; },
    async search() { throw new Error("Unused in this test"); },
  };
  const context: AuditCommandContext = {
    auditRepository,
    clock: { now: () => "2026-09-13T00:00:00.000Z" },
    idGenerator: { generate: () => "unused" },
    authorizer: { hasPermission: async () => true },
    unitOfWork: { run: async action => action({ audit: auditRepository, approval: undefined as never }) },
  };
  const event: InventoryValuationAuditEvent = {
    action: "inventory.valuation.resolve",
    actorId: "user-1",
    companyId: "company-1",
    requestId: "request-1",
    correlationId: "correlation-1",
    occurredAt: context.clock.now(),
    target: { entityType: "inventory-valuation-entry", entityId: "entry-1" },
    reason: null,
    before: null,
    after: null,
    metadata: {},
  };
  return { sink: new SharedInventoryValuationAuditSink(context), entries, event };
}

test("valuation snapshots preserve nested JSON values and shared audit redaction on replay", async () => {
  const { sink, entries, event } = setup();
  const after = { costs: ["123.45", 2, true, null, { password: "secret", currency: "IRR" }] };
  await sink.record({ ...event, after });
  await sink.record({ ...event, after });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.before, null);
  assert.deepEqual(entries[0]?.after, {
    costs: ["123.45", 2, true, null, { password: "[REDACTED]", currency: "IRR" }],
  });
  assert.equal((after.costs[4] as { password: string }).password, "secret");
});

test("valuation snapshots reject unsupported nested values before persistence", async () => {
  for (const value of [undefined, 1n, NaN, Infinity, () => {}, Symbol("value"), new Date()]) {
    for (const field of ["before", "after"] as const) {
      const { sink, entries, event } = setup();
      await assert.rejects(sink.record({ ...event, [field]: { nested: [value] } }), /JSON-compatible values/u);
      assert.equal(entries.length, 0);
    }
  }
});
