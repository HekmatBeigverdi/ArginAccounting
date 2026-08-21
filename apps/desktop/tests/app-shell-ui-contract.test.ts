import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(
  new URL("../src/app/shell/app-shell.tsx", import.meta.url),
  "utf8",
);
const router = readFileSync(
  new URL("../src/app/router/app-router.tsx", import.meta.url),
  "utf8",
);
const contextProvider = readFileSync(
  new URL("../src/app/providers/active-context-provider.tsx", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../src/app/navigation/navigation-items.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/app/shell/app-shell.css", import.meta.url),
  "utf8",
);

test("primary routes use the final application shell", () => {
  assert.match(router, /import \{ AppShell \}/u);
  assert.match(router, /<Route element=\{<AppShell \/>\}>/u);
  assert.doesNotMatch(router, /TemporaryAppShell/u);
});

test("shell exposes grouped collapsible permission-aware navigation", () => {
  assert.match(shell, /collapsedGroups/u);
  assert.match(shell, /aria-expanded/u);
  assert.match(shell, /requiredPermission/u);
  assert.match(shell, /system\.full-access/u);
  assert.match(navigation, /requiredPermission\?: string/u);
});

test("active context is loaded from persisted company branch and fiscal repositories", () => {
  assert.match(contextProvider, /SqliteCompanyRepository/u);
  assert.match(contextProvider, /SqliteBranchRepository/u);
  assert.match(contextProvider, /SqliteFiscalYearRepository/u);
  assert.match(contextProvider, /findByCompanyId\(companyId\)/u);
  assert.match(contextProvider, /findCurrent\(companyId\)/u);
});

test("shell context selectors contain no former hard-coded placeholder values", () => {
  assert.match(shell, /شرکت فعال/u);
  assert.match(shell, /شعبه فعال/u);
  assert.match(shell, /سال مالی فعال/u);
  assert.doesNotMatch(shell, /انتخاب نشده/u);
  assert.doesNotMatch(shell, />مرکزی</u);
});

test("shell owns contained responsive workspace and token-based focus states", () => {
  assert.match(styles, /\.app-shell__workspace\s*\{[^}]*min-width:\s*0/su);
  assert.match(styles, /\.app-shell__main\s*\{[^}]*min-width:\s*0/su);
  assert.match(styles, /var\(--ui-focus-ring\)/u);
  assert.match(styles, /@media \(max-width: 760px\)/u);
});
