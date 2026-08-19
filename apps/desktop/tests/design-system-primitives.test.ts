import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tokens = readFileSync(
  new URL("../src/styles/design-tokens.css", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/components/ui.css", import.meta.url),
  "utf8",
);
const forms = readFileSync(
  new URL("../src/components/forms/index.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(
  new URL("../src/components/layout/index.tsx", import.meta.url),
  "utf8",
);
const dataDisplay = readFileSync(
  new URL("../src/components/data-display/index.tsx", import.meta.url),
  "utf8",
);
const feedback = readFileSync(
  new URL("../src/components/feedback/index.tsx", import.meta.url),
  "utf8",
);

test("design tokens cover typography, spacing, shape, semantic state, focus and density", () => {
  for (const token of [
    "--ui-font-sans",
    "--ui-space-4",
    "--ui-radius-md",
    "--ui-surface",
    "--ui-primary",
    "--ui-danger",
    "--ui-success",
    "--ui-warning",
    "--ui-focus-ring",
    "--ui-control-height",
    "--ui-table-cell-y",
  ]) {
    assert.match(tokens, new RegExp(token));
  }
});

test("form primitives expose buttons and native form controls without business dependencies", () => {
  assert.match(forms, /export const Button/u);
  assert.match(forms, /export const Input/u);
  assert.match(forms, /export const Select/u);
  assert.match(forms, /export const Textarea/u);
  assert.match(forms, /export function Field/u);
  assert.doesNotMatch(forms, /@argin\//u);
  assert.doesNotMatch(forms, /tauri|sqlite/iu);
});

test("shared layout and data-display primitives cover panels, cards, toolbars, badges and tables", () => {
  assert.match(layout, /export function Panel/u);
  assert.match(layout, /export function Card/u);
  assert.match(layout, /export function Toolbar/u);
  assert.match(dataDisplay, /export function Badge/u);
  assert.match(dataDisplay, /export function DataTable/u);
});

test("feedback layer exposes semantic feedback and an accessible dialog contract", () => {
  assert.match(feedback, /export function Feedback/u);
  assert.match(feedback, /role="dialog"/u);
  assert.match(feedback, /aria-modal="true"/u);
  assert.match(feedback, /aria-labelledby/u);
});

test("shared controls define focus-visible, disabled, validation and read-only presentation", () => {
  assert.match(styles, /:focus-visible/u);
  assert.match(styles, /:disabled/u);
  assert.match(styles, /aria-invalid/u);
  assert.match(styles, /:read-only/u);
  assert.match(styles, /\.ui-button--danger/u);
});
