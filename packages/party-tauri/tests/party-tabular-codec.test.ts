import assert from "node:assert/strict";
import test from "node:test";

import {
  createPartyCsv,
  createPartyXlsx,
  parsePartyCsv,
  parsePartyXlsx
} from "../src/index.ts";
import type { PartyExportRow } from "@argin/party";

const rows: readonly PartyExportRow[] = [
  {
    id: "party-1",
    code: "1001",
    classification: "natural-person",
    displayName: "علی رضایی",
    status: "active",
    roles: "customer",
    primaryPhone: "",
    primaryMobile: "09121234567",
    primaryEmail: "ali@example.com",
    updatedAt: "2026-08-30T12:00:00.000Z"
  }
];

test("CSV export can be parsed back as tabular Party data", () => {
  const csv = createPartyCsv(rows);
  const parsed = parsePartyCsv(csv);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.code, "1001");
  assert.equal(parsed.rows[0]?.displayName, "علی رضایی");
});

test("XLSX export can be parsed back as tabular Party data", () => {
  const bytes = createPartyXlsx(rows);
  const parsed = parsePartyXlsx(bytes);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.code, "1001");
  assert.equal(parsed.rows[0]?.primaryMobile, "09121234567");
});
