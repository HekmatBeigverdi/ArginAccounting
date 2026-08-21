import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const app = read("../src/App.tsx");
const shell = read("../src/app/shell/app-shell.tsx");
const shellCss = read("../src/app/shell/app-shell.css");
const accessibilityCss = read("../src/styles/accessibility.css");
const accountingCss = read("../src/pages/accounting/accounting-workspace.css");

test("desktop shell exposes keyboard landmarks and a skip target", () => {
  assert.match(shell, /app-shell__skip-link/u);
  assert.match(shell, /href="#app-main-content"/u);
  assert.match(shell, /id="app-main-content"/u);
  assert.match(shell, /tabIndex=\{-1\}/u);
  assert.match(shell, /aria-controls=\{controlledId\}/u);
  assert.match(shell, /aria-expanded=\{!collapsed\}/u);
  assert.match(shell, /aria-label="ناوبری اصلی"/u);
  assert.match(shell, /aria-label="وضعیت برنامه"/u);
});

test("focus visibility and reduced motion are shared cross-workspace contracts", () => {
  assert.match(app, /styles\/accessibility\.css/u);
  assert.match(accessibilityCss, /:focus-visible/u);
  assert.match(accessibilityCss, /prefers-reduced-motion: reduce/u);
  assert.match(shellCss, /app-shell__skip-link:focus/u);
});

test("RTL mixed content and dense surfaces remain locally contained", () => {
  assert.match(shell, /dir="rtl"/u);
  assert.match(accessibilityCss, /unicode-bidi: isolate/u);
  assert.match(accessibilityCss, /font-variant-numeric: tabular-nums/u);
  assert.match(accessibilityCss, /scrollbar-gutter: stable/u);
  assert.match(accountingCss, /overflow: auto/u);
});

test("supported narrow windows do not require page-level horizontal overflow", () => {
  assert.match(shellCss, /max-width: 100vw/u);
  assert.match(shellCss, /overflow-x: clip/u);
  assert.match(shellCss, /@media \(max-width: 760px\)/u);
  assert.match(shellCss, /app-shell__main[^}]*max-width: 100%/u);
  assert.match(accessibilityCss, /max-height: calc\(100dvh - 1\.5rem\)/u);
});
