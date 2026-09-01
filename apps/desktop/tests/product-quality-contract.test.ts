import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/product/products-page.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/pages/product/products-page.css", import.meta.url),
  "utf8",
);
const tokens = readFileSync(
  new URL("../src/pages/product/products-page-tokens.css", import.meta.url),
  "utf8",
);
const validationCss = readFileSync(
  new URL("../src/pages/product/products-page-validation.css", import.meta.url),
  "utf8",
);

test("Product workspace keeps Persian RTL and mixed-direction identifiers explicit", () => {
  assert.match(page, /lang="fa"\s+dir="rtl"/u);
  assert.match(page, /<code\s+dir="ltr"/u);
  assert.match(page, /<dd\s+dir="ltr"/u);
});

test("Product rows and dialog remain keyboard operable", () => {
  assert.match(page, /tabIndex=\{0\}/u);
  assert.match(page, /event\.key === "Enter"/u);
  assert.match(page, /event\.key === " "/u);
  assert.match(page, /event\.key === "Escape"/u);
  assert.match(page, /role="dialog"/u);
  assert.match(page, /aria-modal="true"/u);
  assert.match(page, /aria-labelledby="product-form-title"/u);
});

test("Product workspace exposes loading and validation semantics", () => {
  assert.match(page, /aria-busy=\{loading\}/u);
  assert.match(page, /role="status"/u);
  assert.match(page, /aria-invalid/u);
  assert.match(validationCss, /aria-invalid/u);
});

test("Product density is bound to canonical Phase 14 density tokens", () => {
  assert.match(tokens, /--ui-density-control-height/u);
  assert.match(tokens, /--ui-density-cell-x/u);
  assert.match(tokens, /--ui-density-cell-y/u);
  assert.match(tokens, /--ui-density-font-size/u);
});

test("Product workspace contains responsive and local overflow behavior", () => {
  assert.match(css, /@media\s*\(max-width:/u);
  assert.match(css, /overflow/u);
  assert.match(css, /position:\s*sticky/u);
});
