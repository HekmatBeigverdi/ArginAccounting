import assert from "node:assert/strict";
import test from "node:test";
import {
  SecuredInventoryQuantityConfirmationPort,
  type InventorySecurityContext,
} from "../src/index.ts";

test("ERP confirmation adapter routes through SecuredInventoryService with caller identity", async () => {
  let securitySeen: InventorySecurityContext | null = null;
  let commandSeen: unknown = null;
  const port = new SecuredInventoryQuantityConfirmationPort({
    inventory: {
      async confirm(security, command) {
        securitySeen = security;
        commandSeen = command;
        return { documentId: command.documentId, status: "confirmed", version: 4, replayed: false };
      },
    },
    securityContext: (actorUserId) => ({ actorId: actorUserId, actorDisplayName: "ERP User", correlationId: "corr-1" }),
  });

  const result = await port.confirm({
    companyId: "company-1",
    inventoryDocumentId: "doc-1",
    expectedVersion: 3,
    actorUserId: "user-1",
    occurredAt: "2026-09-09T00:00:00.000Z",
    requestKey: "request-1",
    payloadFingerprint: "fp-1",
  });

  assert.equal(securitySeen?.actorId, "user-1");
  assert.equal(securitySeen?.actorDisplayName, "ERP User");
  assert.deepEqual(result, { inventoryDocumentId: "doc-1", status: "confirmed", version: 4 });
  assert.equal((commandSeen as { documentId: string }).documentId, "doc-1");
});
