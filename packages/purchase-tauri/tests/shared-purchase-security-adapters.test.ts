import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
