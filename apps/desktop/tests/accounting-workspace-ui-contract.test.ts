import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const coa = read("../src/pages/accounting/chart-of-accounts-page.tsx");
const coaCss = read("../src/pages/accounting/chart-of-accounts-page.css");
const dimensions = read("../src/pages/accounting/accounting-dimensions-page.tsx");
const dimensionsCss = read("../src/pages/accounting/accounting-dimensions-page.css");
const codingTree = read("../src/pages/accounting/coding-template-preview-tree.tsx");
const codingCss = read("../src/pages/accounting/coding-templates-page.css");
const journal = read("../src/pages/accounting/journal-vouchers-page.tsx");
const journalCss = read("../src/pages/accounting/journal-vouchers-page.css");
const sharedCss = read("../src/pages/accounting/accounting-workspace.css");
const appCss = read("../src/App.css");

test("phase 10 to 13 accounting workspaces share the Phase 14 presentation language", () => {
  assert.match(coa, /accounting-workspace coa-page/u);
  assert.match(dimensions, /accounting-workspace dimensions-page/u);
  assert.match(journal, /accounting-workspace journal-page/u);
  assert.match(coa, /\.\/accounting-workspace\.css/u);
  assert.match(dimensions, /\.\/accounting-workspace\.css/u);
  assert.match(journal, /\.\/accounting-workspace\.css/u);
  assert.match(sharedCss, /var\(--ui-/u);
  assert.match(codingCss, /var\(--ui-/u);
});

test("chart of accounts is a real collapsible hierarchical tree", () => {
  assert.match(coa, /role="tree"/u);
  assert.match(coa, /role="treeitem"/u);
  assert.match(coa, /aria-level=\{depth \+ 1\}/u);
  assert.match(coa, /aria-expanded=\{hasChildren \? isExpanded/u);
  assert.match(coa, /toggleNode/u);
  assert.match(coa, /expandAll/u);
  assert.match(coa, /collapseAll/u);
  assert.match(coa, /coa-tree__level-marker/u);
  assert.match(coaCss, /--coa-indent/u);
  assert.match(coaCss, /coa-tree__rail/u);
  assert.match(coaCss, /border-inline-start/u);
});

test("coding template preview uses the same hierarchy cues", () => {
  assert.match(codingTree, /coding-tree__level/u);
  assert.match(codingTree, /<Button type="button" compact/u);
  assert.match(codingCss, /coding-tree__item > details > ul/u);
  assert.match(codingCss, /border-inline-start/u);
});

test("dense accounting surfaces contain their own overflow and use design tokens", () => {
  assert.match(coaCss, /overflow: auto/u);
  assert.match(dimensionsCss, /overflow: auto/u);
  assert.match(codingCss, /overflow-x: auto/u);
  assert.match(journalCss, /overflow-x: auto/u);
  for (const css of [coaCss, dimensionsCss, codingCss, journalCss]) assert.match(css, /var\(--ui-/u);
});

test("legacy Vite and Foundation global selectors no longer compete with workspaces", () => {
  assert.doesNotMatch(appCss, /\.logo\.vite/u);
  assert.doesNotMatch(appCss, /\.temporary-shell/u);
  assert.doesNotMatch(appCss, /\.security-panel/u);
  assert.doesNotMatch(appCss, /\.company-form/u);
  assert.doesNotMatch(appCss, /\.fiscal-form/u);
  assert.doesNotMatch(appCss, /^input,\s*button/mu);
});

test("step 10 does not introduce journal lifecycle controls", () => {
  assert.doesNotMatch(journal, /postVoucher|approveVoucher|reverseVoucher|finalizeVoucher|lockVoucher/u);
});
