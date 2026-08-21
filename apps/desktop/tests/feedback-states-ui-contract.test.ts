import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const feedback = readFileSync(new URL("../src/components/feedback/index.tsx", import.meta.url), "utf8");
const uiCss = readFileSync(new URL("../src/components/ui.css", import.meta.url), "utf8");

describe("Phase 14 feedback state contract", () => {
  it("provides explicit loading, empty, error, and semantic feedback primitives", () => {
    assert.ok(feedback.includes("export function LoadingState"));
    assert.ok(feedback.includes("export function EmptyState"));
    assert.ok(feedback.includes("export function ErrorState"));
    assert.ok(feedback.includes('aria-busy="true"'));
    assert.ok(feedback.includes('aria-live="assertive"'));
    assert.ok(feedback.includes('aria-live="polite"'));
  });

  it("keeps user-facing error text separate from optional technical diagnostics", () => {
    assert.ok(feedback.includes("technicalDetails"));
    assert.ok(feedback.includes("جزئیات فنی"));
    assert.ok(feedback.includes('<pre dir="ltr">'));
  });

  it("uses shared token-based presentation and respects reduced motion", () => {
    assert.ok(uiCss.includes(".ui-state--loading"));
    assert.ok(uiCss.includes(".ui-state--empty"));
    assert.ok(uiCss.includes(".ui-state--error"));
    assert.ok(uiCss.includes("prefers-reduced-motion: reduce"));
    assert.ok(uiCss.includes("var(--ui-danger-soft)"));
  });
});
