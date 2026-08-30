import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  toPartySelectionReference,
  type PartySelectorDto
} from "../src/index.ts";

test("Party package keeps accounting and desktop infrastructure out of the bounded context", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  ) as { dependencies?: Record<string, string> };
  const dependencies = packageJson.dependencies ?? {};

  assert.equal(dependencies["@argin/accounting"], undefined);
  assert.equal(dependencies["@argin/accounting-tauri"], undefined);
  assert.equal(dependencies["@argin/audit"], undefined);
  assert.equal(dependencies["@argin/audit-tauri"], undefined);
  assert.equal(dependencies["@argin/database-tauri"], undefined);
});

test("future document references use durable Party id rather than display code as identity", () => {
  const selector: PartySelectorDto = Object.freeze({
    id: "party-stable-id",
    code: "100245",
    displayName: "شرکت نمونه",
    classification: "legal-entity",
    status: "active",
    roles: Object.freeze(["customer"])
  });

  const reference = toPartySelectionReference(selector);

  assert.equal(reference.partyId, "party-stable-id");
  assert.equal(reference.code, "100245");
  assert.notEqual(reference.partyId, reference.code);
});
