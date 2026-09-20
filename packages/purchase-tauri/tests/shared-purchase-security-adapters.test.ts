import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { AuditCommandContext, AuditEntry, AuditRepository } from "@argin/audit";
import { SharedPurchaseAuditSink } from "../src/shared-purchase-audit-sink.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("shared Purchase Approval identity includes the submission cycle key", async () => {
  const source = await read("../src/shared-purchase-approval-gateway.ts");
  assert.match(source, /purchase-document:\$\{companyId\.trim\(\)\}:\$\{documentId\.trim\(\)\}:\$\{approvalCycleKey\.trim\(\)\}/u);
  assert.match(source, /requestType: PURCHASE_APPROVAL_REQUEST_TYPE/u);
  assert.match(source, /request\.status === "approved"/u);
});

test("shared Purchase Audit identity and metadata keep operation trace", async () => {
  const source = await read("../src/shared-purchase-audit-sink.ts");
  assert.match(source, /event\.operationId/u);
  assert.match(source, /operationId: event\.operationId/u);
  assert.match(source, /requestId: event\.requestId/u);
  assert.match(source, /purchaseAction: event\.action/u);
  assert.match(source, /auditRepository\.findById/u);
});

test("draft edit audit is persisted as an update with the edited version", async () => {
  const entries: AuditEntry[] = [];
  const audit = {
    async findById() { return null; },
    async create(entry: AuditEntry) { entries.push(entry); },
  } as unknown as AuditRepository;
  const context: AuditCommandContext = {
    clock: { now: () => "2026-09-19T10:00:00.000Z" },
    idGenerator: { generate: () => "audit-id" },
    authorizer: { async hasPermission() { return true; } },
    auditRepository: audit,
    unitOfWork: { async run(work) { return work({ audit, approval: {} as never }); } },
  };
  await new SharedPurchaseAuditSink(context).record({
    action: "purchase.document.edit", actorId: "user", companyId: "company", branchId: "branch",
    documentId: "purchase", requestId: "request", operationId: "operation", correlationId: "correlation",
    occurredAt: "2026-09-19T10:00:00.000Z", beforeStatus: "draft", afterStatus: "draft", reason: null,
    metadata: { version: 2 },
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.action, "update");
  assert.equal(entries[0]?.metadata?.version, 2);
  assert.equal(entries[0]?.metadata?.purchaseAction, "purchase.document.edit");
});
