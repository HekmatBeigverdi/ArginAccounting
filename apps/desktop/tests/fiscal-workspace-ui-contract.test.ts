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
const datePicker = readFileSync(
  new URL("../src/components/forms/persian-date-picker.tsx", import.meta.url),
  "utf8"
);
const sharedStyles = readFileSync(
  new URL("../src/components/ui.css", import.meta.url),
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

test("fiscal creation uses shared Solar Hijri entry and existing application use case", () => {
  assert.match(form, /createFiscalYear/u);
  assert.match(form, /SqliteFiscalUnitOfWork/u);
  assert.match(form, /<PersianDatePicker/u);
  assert.match(form, /<Field/u);
  assert.match(form, /<Select/u);
  assert.match(form, /<Button/u);
  assert.match(form, /<Feedback/u);
  assert.doesNotMatch(form, /type="date"/u);
  assert.doesNotMatch(form, /console\.(log|error)/u);
});

test("shared Persian date picker preserves Gregorian ISO boundary", () => {
  assert.match(datePicker, /fa-IR-u-ca-persian-nu-latn/u);
  assert.match(datePicker, /gregorianIsoToPersian/u);
  assert.match(datePicker, /persianToGregorianIso/u);
  assert.match(datePicker, /toISOString\(\)\.slice\(0, 10\)/u);
  assert.match(datePicker, /انتخاب تاریخ شمسی/u);
  assert.match(datePicker, /امروز/u);
  assert.doesNotMatch(datePicker, /@argin\//u);
});

test("new fiscal route uses a compact unified creation workspace", () => {
  assert.match(newPage, /fiscal-workspace__create-shell/u);
  assert.match(newPage, /fiscal-workspace__context-strip/u);
  assert.match(newPage, /<FiscalYearForm/u);
  assert.doesNotMatch(newPage, /fiscal-workspace__create-aside/u);
  assert.doesNotMatch(newPage, /temporary-page/u);
});

test("fiscal form explicitly neutralizes legacy fiscal-form grid rules", () => {
  assert.match(styles, /\.fiscal-form \{/u);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) !important/u);
  assert.match(styles, /margin: 0 !important/u);
  assert.match(styles, /padding: 0 !important/u);
  assert.match(styles, /\.fiscal-form button\.ui-button/u);
});

test("Persian calendar controls resist legacy global button styling", () => {
  assert.match(sharedStyles, /\.ui-persian-date__popover button/u);
  assert.match(sharedStyles, /min-width: 0 !important/u);
  assert.match(sharedStyles, /padding: 0 !important/u);
  assert.match(sharedStyles, /z-index: 1200/u);
  assert.match(sharedStyles, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/u);
});

test("fiscal workspace is token based responsive and visually contained", () => {
  assert.match(styles, /var\(--ui-/u);
  assert.match(styles, /\.fiscal-workspace__year:focus-visible/u);
  assert.match(styles, /\.fiscal-workspace__create-shell/u);
  assert.match(styles, /\.fiscal-form__actions \.ui-button--primary/u);
  assert.match(styles, /@media \(max-width: 980px\)/u);
  assert.match(styles, /@media \(max-width: 680px\)/u);
});

test("step 7 does not introduce future fiscal or journal lifecycle actions", () => {
  assert.doesNotMatch(workspace, /closeFiscal|reopenFiscal|postJournal|reverseJournal|finalizeJournal/iu);
  assert.doesNotMatch(form, /closeFiscal|reopenFiscal|postJournal|reverseJournal|finalizeJournal/iu);
});
