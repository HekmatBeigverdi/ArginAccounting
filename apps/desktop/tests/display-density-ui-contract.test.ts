import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const provider = readFileSync(new URL("../src/app/providers/display-density-provider.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/app/shell/app-shell.tsx", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../src/styles/design-tokens.css", import.meta.url), "utf8");

describe("Phase 14 global display density contract", () => {
  it("supports compact, comfortable, and spacious with comfortable as default", () => {
    expect(provider).toContain('export type DisplayDensity = "compact" | "comfortable" | "spacious"');
    expect(provider).toContain('const DEFAULT_DENSITY: DisplayDensity = "comfortable"');
    expect(tokens).toContain(':root[data-density="compact"]');
    expect(tokens).toContain(':root[data-density="comfortable"]');
    expect(tokens).toContain(':root[data-density="spacious"]');
  });

  it("persists the preference and applies it globally at the document root", () => {
    expect(provider).toContain('argin.ui.display-density');
    expect(provider).toContain('document.documentElement.dataset.density = density');
    expect(provider).toContain('window.localStorage.setItem(STORAGE_KEY, density)');
    expect(app).toContain("<DisplayDensityProvider>");
  });

  it("exposes a Persian global selector in the application shell", () => {
    expect(shell).toContain("تراکم نمایش");
    expect(shell).toContain("فشرده");
    expect(shell).toContain("استاندارد");
    expect(shell).toContain("بزرگ");
    expect(shell).toContain("setDensity");
  });
});
