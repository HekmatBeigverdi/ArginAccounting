import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../src/pages/dashboard/dashboard-page.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/pages/dashboard/dashboard-page.css", import.meta.url),
  "utf8",
);

test("dashboard uses the shared Phase 14 design-system surface", () => {
  assert.match(dashboard, /useActiveContext/u);
  assert.match(dashboard, /<Page className="dashboard-page"/u);
  assert.match(dashboard, /<Card/u);
  assert.match(dashboard, /<Panel/u);
  assert.match(dashboard, /<Badge/u);
  assert.doesNotMatch(dashboard, /temporary-page/u);
  assert.doesNotMatch(dashboard, /temporary-dashboard/u);
});

test("dashboard contains no stale development or phase-status copy", () => {
  assert.doesNotMatch(dashboard, /داشبورد موقت/u);
  assert.doesNotMatch(dashboard, /در حال توسعه/u);
  assert.doesNotMatch(dashboard, /فاز\s*[۰-۹0-9]+/u);
});

test("dashboard presents real active company branch and fiscal context", () => {
  assert.match(dashboard, /context\.activeCompany/u);
  assert.match(dashboard, /context\.activeBranch/u);
  assert.match(dashboard, /context\.activeFiscalYear/u);
  assert.match(dashboard, /fiscalStatusLabels/u);
  assert.match(dashboard, /formatJournalVoucherDate/u);
});

test("dashboard uses existing journal read contracts for recent drafts", () => {
  assert.match(dashboard, /journals\.list/u);
  assert.match(dashboard, /fiscalYearId:\s*context\.fiscalYearId/u);
  assert.match(dashboard, /pageSize:\s*5/u);
  assert.match(dashboard, /accounting\.journal-vouchers\.view/u);
  assert.doesNotMatch(dashboard, /posting|finaliz|reversal|lockJournal/iu);
});

test("dashboard has coherent empty states and implemented-module shortcuts", () => {
  assert.match(dashboard, /هنوز شرکتی ثبت نشده است/u);
  assert.match(dashboard, /سال مالی فعالی برای نمایش اسناد وجود ندارد/u);
  assert.match(dashboard, /هنوز سندی در این زمینه ثبت نشده است/u);
  assert.match(dashboard, /\/accounting\/journal-vouchers/u);
  assert.match(dashboard, /\/accounting\/chart-of-accounts/u);
  assert.match(dashboard, /\/company\/setup/u);
  assert.match(dashboard, /\/fiscal\/years/u);
});

test("dashboard layout is responsive and token based", () => {
  assert.match(styles, /var\(--ui-/u);
  assert.match(styles, /@media \(max-width: 1050px\)/u);
  assert.match(styles, /@media \(max-width: 720px\)/u);
  assert.match(styles, /\.dashboard-page__shortcut:focus-visible/u);
});
