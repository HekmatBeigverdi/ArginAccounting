import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const journal = readFileSync(
  new URL("../src/pages/accounting/journal-vouchers-page.tsx", import.meta.url),
  "utf8",
);
const isolation = readFileSync(
  new URL("../src/styles/persian-date-isolation.css", import.meta.url),
  "utf8",
);

test("journal voucher user-facing date inputs use the shared Persian date picker", () => {
  assert.match(journal, /import \{ PersianDatePicker \} from "\.\.\/\.\.\/components\/forms"/u);
  assert.match(journal, /ariaLabel="از تاریخ"/u);
  assert.match(journal, /ariaLabel="تا تاریخ"/u);
  assert.match(journal, /ariaLabel="تاریخ سند"/u);
  assert.equal((journal.match(/<PersianDatePicker/g) ?? []).length, 3);
  assert.doesNotMatch(journal, /type="date"/u);
});

test("journal date filters keep Gregorian ISO values at the application boundary", () => {
  assert.match(journal, /\.\.\.\(dateFrom \? \{ dateFrom \} : \{\}\)/u);
  assert.match(journal, /\.\.\.\(dateTo \? \{ dateTo \} : \{\}\)/u);
  assert.match(journal, /voucherDate: draft\.voucherDate/u);
  assert.match(journal, /documentDate: voucherDate/u);
});

test("shared Persian calendar is isolated from feature-level generic button styling", () => {
  assert.match(isolation, /\.ui-persian-date \.ui-persian-date__day/u);
  assert.match(isolation, /border: 0 !important/u);
  assert.match(isolation, /ui-persian-date__day--active/u);
});
