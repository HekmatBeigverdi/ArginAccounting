import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/pages/fiscal/fiscal-years-page.tsx", import.meta.url),
  "utf8"
);
const newPage = readFileSync(
  new URL("../src/pages/fiscal/new-fiscal-year-page.tsx", import.meta.url),
  "utf8"
);
const form = readFileSync(
  new URL("../src/features/fiscal/fiscal-year-form.tsx", import.meta.url),
  "utf8"
);
const styles = readFileSync(
  new URL("../src/pages/fiscal/fiscal-workspace.css", import.meta.url),
  "utf8"
);

test("fiscal years is a management workspace rather than a create-page alias", () => {
  assert.match(workspace, /useActiveContext/u);
  assert.match(workspace, /context\.fiscalYears/u);
  assert.match(workspace, /context\.activeFiscalYear/u);
  assert.match(workspace, /SqliteFiscalPeriodRepository/u);
  assert.doesNotMatch(workspace, /return <NewFiscalYearPage/u);
  assert.doesNotMatch(workspace, /temporary-page/u);
});

test("fiscal workspace presents supported year and period state", () => {
  assert.match(workspace, /yearStatusLabels/u);
  assert.match(workspace, /periodStatusLabels/u);
  assert.match(workspace, /year\.isCurrent/u);
  assert.match(workspace, /period\.status/u);
  assert.match(workspace, /formatJournalVoucherDate/u);
});

test("fiscal creation keeps existing application use case and shared primitives", () => {
  assert.match(form, /createFiscalYear/u);
  assert.match(form, /SqliteFiscalUnitOfWork/u);
  assert.match(form, /<Field/u);
  assert.match(form, /<Input/u);
  assert.match(form, /<Select/u);
  assert.match(form, /<Button/u);
  assert.match(form, /<Feedback/u);
  assert.doesNotMatch(form, /console\.(log|error)/u);
});

test("new fiscal route no longer uses temporary presentation", () => {
  assert.match(newPage, /<Page className="fiscal-workspace"/u);
  assert.match(newPage, /<Panel/u);
  assert.doesNotMatch(newPage, /temporary-page/u);
});

test("fiscal workspace is token based responsive and keyboard visible", () => {
  assert.match(styles, /var\(--ui-/u);
  assert.match(styles, /\.fiscal-workspace__year:focus-visible/u);
  assert.match(styles, /@media \(max-width: 980px\)/u);
  assert.match(styles, /@media \(max-width: 680px\)/u);
});

test("step 7 does not introduce future fiscal or journal lifecycle actions", () => {
  assert.doesNotMatch(workspace, /closeFiscal|reopenFiscal|postJournal|reverseJournal|finalizeJournal/iu);
  assert.doesNotMatch(form, /closeFiscal|reopenFiscal|postJournal|reverseJournal|finalizeJournal/iu);
});
