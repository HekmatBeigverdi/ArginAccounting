import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/product/products-page.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../src/app/router/app-router.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/app/navigation/navigation-items.ts", import.meta.url), "utf8");
const validationCss = readFileSync(new URL("../src/pages/product/products-page-validation.css", import.meta.url), "utf8");
const helpController = readFileSync(new URL("../src/pages/product/product-help-controller.ts", import.meta.url), "utf8");

test("Product workspace is routed and permission-aware", () => {
  assert.match(router, /master-data\/products/u);
  assert.match(navigation, /master-data\.products\.view/u);
  assert.match(navigation, /کالاها و خدمات/u);
});

test("Product list remains bounded and exposes loading, empty and error UI states", () => {
  assert.match(page, /pageSize:\s*40/u);
  assert.match(page, /loading/u);
  assert.match(page, /empty/u);
  assert.match(page, /error/u);
});

test("field validation exposes invalid controls and nearby field errors", () => {
  assert.match(page, /aria-invalid/u);
  assert.match(validationCss, /aria-invalid/u);
  assert.match(validationCss, /product-field-error/u);
});

test("field help is click-controlled and viewport-aware instead of hover-only", () => {
  assert.match(helpController, /getBoundingClientRect/u);
  assert.match(helpController, /Escape/u);
  assert.match(helpController, /position/u);
  assert.doesNotMatch(validationCss, /:hover[^\{]*\{[^\}]*display:\s*block/us);
});

test("Taxpayer unit selection is reference-data based rather than a free-form official code", () => {
  assert.match(page, /taxpayerUnitOptions/u);
  assert.match(page, /انتخاب واحد/u);
  assert.match(page, /taxpayerUnitCode/u);
});

test("Product React surface does not execute direct Product SQL", () => {
  assert.doesNotMatch(page, /SELECT\s+.+\s+FROM\s+products/iu);
  assert.doesNotMatch(page, /INSERT\s+INTO\s+products/iu);
  assert.doesNotMatch(page, /UPDATE\s+products/iu);
});
