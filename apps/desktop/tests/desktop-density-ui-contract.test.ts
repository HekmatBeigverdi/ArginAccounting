import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(new URL("../src/styles/design-tokens.css", import.meta.url), "utf8");
const accounting = readFileSync(new URL("../src/pages/accounting/accounting-workspace.css", import.meta.url), "utf8");
const coa = readFileSync(new URL("../src/pages/accounting/chart-of-accounts-page.css", import.meta.url), "utf8");

describe("Phase 14 desktop density contract", () => {
  it("defines reusable operational density tokens instead of page-only magic numbers", () => {
    expect(tokens).toContain("--ui-density-row-height: 1.875rem");
    expect(tokens).toContain("--ui-density-tree-row-height: 2rem");
    expect(tokens).toContain("--ui-density-control-height: 2rem");
    expect(tokens).toContain("--ui-workspace-height: calc(100dvh - 10.5rem)");
  });

  it("keeps dense accounting grids locally scrollable with sticky headers", () => {
    expect(accounting).toContain("position: sticky");
    expect(accounting).toContain("scrollbar-gutter: stable");
    expect(accounting).toContain("overscroll-behavior: contain");
    expect(accounting).toContain("height: var(--ui-density-row-height)");
  });

  it("presents a compact chart tree while preserving hierarchy and responsive degradation", () => {
    expect(coa).toContain("min-height: var(--ui-density-tree-row-height)");
    expect(coa).toContain("--coa-indent: calc(var(--coa-depth) * 1.15rem)");
    expect(coa).toContain(".coa-tree__rail");
    expect(coa).toContain("height: clamp(24rem, calc(100dvh - 18rem), 46rem)");
    expect(coa).toContain("@media (max-width: 1200px)");
  });
});
