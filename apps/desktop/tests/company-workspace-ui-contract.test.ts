import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/company/company-setup-page.tsx", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/features/company/company-setup-form.tsx", import.meta.url),
  "utf8",
);
const setupUseCase = readFileSync(
  new URL("../../../packages/company/src/application/setup-company.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/pages/company/company-workspace.css", import.meta.url),
  "utf8",
);

test("company route is a management workspace rather than a create-only temporary page", () => {
  assert.match(page, /شرکت‌ها و شعب/u);
  assert.match(page, /context\.companies\.map/u);
  assert.match(page, /context\.branches\.map/u);
  assert.match(page, /تعریف شرکت جدید/u);
  assert.doesNotMatch(page, /temporary-page/u);
});

test("company workspace uses the persisted active context and existing activity update use case", () => {
  assert.match(page, /useActiveContext/u);
  assert.match(page, /updateCompanyActivityType/u);
  assert.match(page, /companyProfilePermissions\.updateActivityType/u);
  assert.match(page, /SqliteCompanyUnitOfWork/u);
  assert.match(page, /context\.refresh\(\)/u);
});

test("company setup form is migrated to shared form and feedback primitives", () => {
  assert.match(form, /<Field/u);
  assert.match(form, /<Input/u);
  assert.match(form, /<Select/u);
  assert.match(form, /<Textarea/u);
  assert.match(form, /<Button/u);
  assert.match(form, /<Feedback/u);
  assert.match(form, /onCreated/u);
});

test("normal company creation flow contains no development console logging", () => {
  assert.doesNotMatch(form, /console\.(log|error|debug)/u);
  assert.doesNotMatch(setupUseCase, /console\.(log|error|debug)/u);
});

test("company workspace styling is responsive and token based", () => {
  assert.match(styles, /var\(--ui-/u);
  assert.match(styles, /\.company-workspace__grid/u);
  assert.match(styles, /\.company-setup-form__grid/u);
  assert.match(styles, /@media \(max-width: 1050px\)/u);
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(styles, /:focus-visible/u);
});
