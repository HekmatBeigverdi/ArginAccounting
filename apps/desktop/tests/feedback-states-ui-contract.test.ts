import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const feedback = readFileSync(new URL("../src/components/feedback/index.tsx", import.meta.url), "utf8");
const uiCss = readFileSync(new URL("../src/components/ui.css", import.meta.url), "utf8");

describe("Phase 14 feedback state contract", () => {
  it("provides explicit loading, empty, error, and semantic feedback primitives", () => {
    expect(feedback).toContain("export function LoadingState");
    expect(feedback).toContain("export function EmptyState");
    expect(feedback).toContain("export function ErrorState");
    expect(feedback).toContain('aria-busy="true"');
    expect(feedback).toContain('aria-live="assertive"');
    expect(feedback).toContain('aria-live="polite"');
  });

  it("keeps user-facing error text separate from optional technical diagnostics", () => {
    expect(feedback).toContain("technicalDetails");
    expect(feedback).toContain("جزئیات فنی");
    expect(feedback).toContain('<pre dir="ltr">');
  });

  it("uses shared token-based presentation and respects reduced motion", () => {
    expect(uiCss).toContain(".ui-state--loading");
    expect(uiCss).toContain(".ui-state--empty");
    expect(uiCss).toContain(".ui-state--error");
    expect(uiCss).toContain("prefers-reduced-motion: reduce");
    expect(uiCss).toContain("var(--ui-danger-soft)");
  });
});
