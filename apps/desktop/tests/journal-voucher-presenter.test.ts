import assert from "node:assert/strict";
import test from "node:test";

import { JournalVoucherApplicationError } from "@argin/accounting/journal";

import {
  formatJournalRials,
  formatJournalVoucherDate,
  parseRialInput,
  presentJournalVoucherError,
} from "../src/features/accounting/journal-voucher-presenter.ts";

test("journal presenter shows canonical dates as Solar Hijri", () => {
  const value = formatJournalVoucherDate("2026-04-01");
  assert.match(value, /۱۴۰۵|1405/u);
  assert.doesNotMatch(value, /2026/u);
});

test("journal presenter formats amounts explicitly as Iranian Rial", () => {
  const value = formatJournalRials(1_250_000);
  assert.match(value, /ریال/u);
  assert.match(value, /۱|1/u);
});

test("journal Rial parser accepts Persian and Arabic digits and separators", () => {
  assert.equal(parseRialInput("۱٬۲۵۰٬۰۰۰"), 1_250_000);
  assert.equal(parseRialInput("١٢٥٠٠٠٠"), 1_250_000);
  assert.equal(parseRialInput(""), 0);
  assert.equal(Number.isNaN(parseRialInput("12.5")), true);
});

test("business errors stay actionable without exposing technical diagnostics", () => {
  const result = presentJournalVoucherError(
    new JournalVoucherApplicationError(
      "journal.version-conflict",
      "سند توسط کاربر دیگری تغییر کرده است.",
    ),
  );
  assert.equal(result.message, "سند توسط کاربر دیگری تغییر کرده است.");
  assert.equal(result.technical, null);
});

test("unexpected errors are separated into user message and technical details", () => {
  const result = presentJournalVoucherError(new Error("SQLITE_BUSY: database is locked"));
  assert.match(result.message, /جزئیات فنی/u);
  assert.equal(result.technical, "Error: SQLITE_BUSY: database is locked");
});
