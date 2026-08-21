import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const provider = readFileSync(new URL("../src/app/providers/display-density-provider.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/app/shell/app-shell.tsx", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../src/styles/design-tokens.css", import.meta.url), "utf8");

describe("Phase 14 global display density contract", () => {
  it("supports compact, comfortable, and spacious with comfortable as default", () => {
    assert.ok(provider.includes('export type DisplayDensity = "compact" | "comfortable" | "spacious"'));
    assert.ok(provider.includes('const DEFAULT_DENSITY: DisplayDensity = "comfortable"'));
    assert.ok(tokens.includes(':root[data-density="compact"]'));
    assert.ok(tokens.includes(':root[data-density="comfortable"]'));
    assert.ok(tokens.includes(':root[data-density="spacious"]'));
  });

  it("persists the preference and applies it globally at the document root", () => {
    assert.ok(provider.includes('argin.ui.display-density'));
    assert.ok(provider.includes('document.documentElement.dataset.density = density'));
    assert.ok(provider.includes('window.localStorage.setItem(STORAGE_KEY, density)'));
    assert.ok(app.includes("<DisplayDensityProvider>"));
  });

  it("exposes a Persian global selector in the application shell", () => {
    assert.ok(shell.includes("تراکم نمایش"));
    assert.ok(shell.includes("فشرده"));
    assert.ok(shell.includes("استاندارد"));
    assert.ok(shell.includes("بزرگ"));
    assert.ok(shell.includes("setDensity"));
  });
});
