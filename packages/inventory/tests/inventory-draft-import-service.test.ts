import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/application/inventory-draft-import-service.ts", import.meta.url), "utf8");

test("inventory import uses deterministic batch and document request identity", () => {
  assert.match(source, /inventory-import:\$\{batchId\}:\$\{importKey\}/u);
  assert.match(source, /documentId\(batchId, importKey\)/u);
  assert.match(source, /result\.replayed/u);
});

test("generated createdAt metadata is excluded from retry fingerprint", () => {
  assert.match(source, /createdAt:\s*_createdAt/u);
  assert.match(source, /canonicalize\(businessPayload\)/u);
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
