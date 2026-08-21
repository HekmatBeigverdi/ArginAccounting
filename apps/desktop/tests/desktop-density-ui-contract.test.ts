import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const tokens = readFileSync(new URL("../src/styles/design-tokens.css", import.meta.url), "utf8");
const accounting = readFileSync(new URL("../src/pages/accounting/accounting-workspace.css", import.meta.url), "utf8");
const coa = readFileSync(new URL("../src/pages/accounting/chart-of-accounts-page.css", import.meta.url), "utf8");

describe("Phase 14 desktop density contract", () => {
  it("defines reusable operational density tokens instead of page-only magic numbers", () => {
    assert.ok(tokens.includes("--ui-density-row-height: 1.875rem"));
    assert.ok(tokens.includes("--ui-density-tree-row-height: 2rem"));
    assert.ok(tokens.includes("--ui-density-control-height: 2rem"));
    assert.ok(tokens.includes("--ui-workspace-height: calc(100dvh - 10.5rem)"));
  });

  it("keeps dense accounting grids locally scrollable with sticky headers", () => {
    assert.ok(accounting.includes("position: sticky"));
    assert.ok(accounting.includes("scrollbar-gutter: stable"));
    assert.ok(accounting.includes("overscroll-behavior: contain"));
    assert.ok(accounting.includes("height: var(--ui-density-row-height)"));
  });

  it("presents a compact chart tree while preserving hierarchy and responsive degradation", () => {
    assert.ok(coa.includes("min-height: var(--ui-density-tree-row-height)"));
    assert.ok(coa.includes("--coa-indent: calc(var(--coa-depth) * 1.15rem)"));
    assert.ok(coa.includes(".coa-tree__rail"));
    assert.ok(coa.includes("height: clamp(24rem, calc(100dvh - 18rem), 46rem)"));
    assert.ok(coa.includes("@media (max-width: 1200px)"));
  });
});
