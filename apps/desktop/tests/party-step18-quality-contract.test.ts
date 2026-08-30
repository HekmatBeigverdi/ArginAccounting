import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  page: new URL("../src/pages/party/parties-page.tsx", import.meta.url),
  pageCss: new URL("../src/pages/party/parties-page.css", import.meta.url),
  selector: new URL("../src/components/party/party-selector.tsx", import.meta.url),
  selectorCss: new URL("../src/components/party/party-selector.css", import.meta.url),
  importDialog: new URL("../src/pages/party/party-import-dialog.tsx", import.meta.url)
};

test("Party workspace preserves bounded paging and deferred search", async () => {
  const source = await readFile(files.page, "utf8");
  assert.match(source, /useDeferredValue\(search\)/);
  assert.match(source, /pageSize:\s*40/);
  assert.match(source, /setPage\(1\)/);
  assert.doesNotMatch(source, /findAll\s*\(/);
});

test("Party list and dialog expose keyboard and accessibility semantics", async () => {
  const source = await readFile(files.page, "utf8");
  assert.match(source, /aria-label="جستجو و فیلتر اشخاص"/);
  assert.match(source, /aria-busy=\{loading\}/);
  assert.match(source, /role="status"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-label="بستن"/);
});

test("Party selector remains an accessible bounded combobox", async () => {
  const source = await readFile(files.selector, "utf8");
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-autocomplete="list"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Enter/);
  assert.match(source, /Escape/);
  assert.match(source, /limit = 20/);
});

test("Party UI keeps RTL presentation with explicit LTR islands for identifiers", async () => {
  const source = await readFile(files.page, "utf8");
  assert.match(source, /dir="ltr"/);
  assert.match(source, /fa-IR-u-ca-persian/);
  const css = await readFile(files.pageCss, "utf8");
  assert.match(css, /direction:\s*rtl/);
});

test("Party density and responsive contracts stay aligned with compact desktop UI", async () => {
  const pageCss = await readFile(files.pageCss, "utf8");
  const selectorCss = await readFile(files.selectorCss, "utf8");
  assert.match(pageCss, /--control-height/);
  assert.match(pageCss, /--table-row-height/);
  assert.match(pageCss, /@media\s*\(max-width:/);
  assert.match(selectorCss, /var\(--control-height/);
});

test("bulk import keeps preview and atomic-mode controls visible in the Desktop boundary", async () => {
  const source = await readFile(files.importDialog, "utf8");
  assert.match(source, /previewImport/);
  assert.match(source, /atomic/);
  assert.match(source, /parsePartyCsv/);
  assert.match(source, /parsePartyXlsx/);
});
