import assert from "node:assert/strict";
import test from "node:test";

import {
  createPartyCsv,
  createPartyMasterCsv,
  createPartyMasterXlsx,
  createPartyXlsx,
  parsePartyCsv,
  parsePartyXlsx
} from "../src/index.ts";
import type { PartyExportRow, PartyMasterExportRow } from "@argin/party";

const rows: readonly PartyExportRow[] = [{
  id: "party-1", code: "1001", classification: "natural-person", displayName: "علی رضایی",
  status: "active", roles: "customer", primaryPhone: "", primaryMobile: "09121234567",
  primaryEmail: "ali@example.com", updatedAt: "2026-08-30T12:00:00.000Z"
}];

const masterRows: readonly PartyMasterExportRow[] = [{
  id: "party-1", code: "1001", classification: "natural-person", status: "active",
  firstName: "علی", lastName: "رضایی", legalName: "", tradeName: "", nationalCode: "0084575948",
  nationalId: "", registrationNumber: "", economicNumber: "", taxFileNumber: "1234", roles: "customer",
  phone: "", mobile: "09121234567", email: "ali@example.com", addressLine: "تهران، خیابان نمونه",
  postalCode: "1234567890", createdAt: "2026-08-30T12:00:00.000Z", updatedAt: "2026-08-30T12:00:00.000Z"
}];

test("CSV export can be parsed back as tabular Party data", () => {
  const parsed = parsePartyCsv(createPartyCsv(rows));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.code, "1001");
  assert.equal(parsed.rows[0]?.displayName, "علی رضایی");
});

test("XLSX export can be parsed back as tabular Party data", () => {
  const parsed = parsePartyXlsx(createPartyXlsx(rows));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.code, "1001");
  assert.equal(parsed.rows[0]?.primaryMobile, "09121234567");
});

test("master-data CSV preserves identity and address columns", () => {
  const parsed = parsePartyCsv(createPartyMasterCsv(masterRows));
  assert.equal(parsed.rows[0]?.nationalCode, "0084575948");
  assert.equal(parsed.rows[0]?.addressLine, "تهران، خیابان نمونه");
});

test("master-data XLSX preserves registration transfer columns", () => {
  const parsed = parsePartyXlsx(createPartyMasterXlsx(masterRows));
  assert.equal(parsed.rows[0]?.taxFileNumber, "1234");
  assert.equal(parsed.rows[0]?.postalCode, "1234567890");
});
