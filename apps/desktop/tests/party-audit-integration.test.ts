import assert from "node:assert/strict";
import test from "node:test";

import type { PartyAuditEvent } from "@argin/party";

import { toSharedAuditEntryInput } from "../src/pages/party/party-audit-sink.ts";

const baseEvent = {
  actorId: "user-1",
  companyId: "company-1",
  partyId: "party-1",
  correlationId: "corr-1",
  requestId: "req-1",
  occurredAt: "2026-08-30T15:00:00.000Z",
  metadata: Object.freeze({ role: "customer" })
} as const;

test("Party audit mapping preserves actor, company scope and correlation metadata", () => {
  const event: PartyAuditEvent = Object.freeze({
    ...baseEvent,
    action: "party.update"
  });

  const input = toSharedAuditEntryInput(event);

  assert.equal(input.action, "update");
  assert.equal(input.source, "desktop");
  assert.equal(input.outcome, "success");
  assert.equal(input.actor.id, "user-1");
  assert.equal(input.scope?.companyId, "company-1");
  assert.equal(input.target.entityType, "party");
  assert.equal(input.target.entityId, "party-1");
  assert.equal(input.correlationId, "corr-1");
  assert.equal(input.metadata?.requestId, "req-1");
  assert.equal(input.metadata?.partyAction, "party.update");
});

test("Party role and bulk actions map to canonical shared Audit actions", () => {
  const cases = [
    ["party.add-role", "assign"],
    ["party.remove-role", "unassign"],
    ["party.import", "import"],
    ["party.export", "export"],
    ["party.change-status", "status-change"]
  ] as const;

  for (const [partyAction, expectedAuditAction] of cases) {
    const input = toSharedAuditEntryInput(Object.freeze({
      ...baseEvent,
      action: partyAction
    }));
    assert.equal(input.action, expectedAuditAction);
  }
});
