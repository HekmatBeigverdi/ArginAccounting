import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { InventoryDraftImportService } from "../src/application/inventory-draft-import-service.ts";
import { InventoryDraftService } from "../src/application/inventory-draft-service.ts";
import { createInventoryDocument } from "../src/domain/inventory-document.ts";
import type { CreateInventoryDocumentCommand } from "../src/application/contracts/inventory-commands.ts";

const source = await readFile(new URL("../src/application/inventory-draft-import-service.ts", import.meta.url), "utf8");

test("inventory import uses deterministic batch and document request identity", () => {
  assert.match(source, /inventory-import:\$\{batchId\}:\$\{importKey\}/u);
  assert.match(source, /documentId\(batchId, importKey\)/u);
  assert.match(source, /result\.replayed/u);
});

test("generated createdAt metadata is excluded from retry fingerprint", async (context) => {
  const drafts = new InventoryDraftService({
    async execute() {
      throw new Error("The mocked draft service must handle persistence.");
    },
  });
  const commands: CreateInventoryDocumentCommand[] = [];
  context.mock.method(drafts, "create", async (command: CreateInventoryDocumentCommand) => {
    commands.push(command);
    return { document: createInventoryDocument(command.document), replayed: false };
  });
  const importer = new InventoryDraftImportService(drafts, {
    documentId: (batchId, importKey) => `${batchId}:${importKey}`,
  });

  for (const [createdAt, description] of [
    ["2026-01-01T08:00:00.000Z", "Original receipt"],
    ["2026-01-01T09:00:00.000Z", "Original receipt"],
    ["2026-01-01T09:00:00.000Z", "Changed receipt"],
  ] as const) {
    const result = await importer.import({
      companyId: "company-1",
      batchId: "batch-1",
      documents: [{
        importKey: "receipt-1",
        document: {
          companyId: "company-1",
          documentType: "receipt",
          businessDate: "2026-01-01",
          createdAt,
          description,
          lines: [],
        },
      }],
    });
    assert.deepEqual(result.failures, []);
    assert.equal(result.imported.length, 1);
  }

  assert.equal(commands.length, 3);
  const [original, retry, changed] = commands;
  assert.ok(original && retry && changed);
  assert.notEqual(original.document.createdAt, retry.document.createdAt);
  assert.equal(original.requestKey, retry.requestKey);
  assert.equal(original.payloadFingerprint, retry.payloadFingerprint);
  assert.notEqual(original.payloadFingerprint, changed.payloadFingerprint);
});

test("bulk import persists through InventoryDraftService only", () => {
  assert.match(source, /InventoryDraftService/u);
  assert.match(source, /this\.drafts\.create/u);
  assert.doesNotMatch(source, /\.submit\(|\.approve\(|\.confirm\(/u);
});

test("duplicate logical document keys in one batch are rejected", () => {
  assert.match(source, /seen\.has\(importKey\)/u);
  assert.match(source, /inventory\.import\.document-key-duplicate/u);
});
