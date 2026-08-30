import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Party workspace composes secured Application/Reader boundaries", async () => {
  const source = await read("../src/pages/party/parties-page.tsx");

  assert.match(source, /new SecuredPartyReader\(/);
  assert.match(source, /new SecuredPartyApplicationService\(/);
  assert.match(source, /partyPermissions\.view/);
  assert.match(source, /partyPermissions\.create/);
  assert.match(source, /partyPermissions\.update/);
  assert.match(source, /partyPermissions\.changeStatus/);
  assert.match(source, /partyPermissions\.manageRoles/);
  assert.match(source, /createPersistentPartyAuditSink\(database\)/);
});

test("Party workspace keeps list retrieval bounded and company-scoped", async () => {
  const source = await read("../src/pages/party/parties-page.tsx");

  assert.match(source, /companyId: active\.companyId/);
  assert.match(source, /pageSize: 40/);
  assert.match(source, /useDeferredValue\(search\)/);
  assert.doesNotMatch(source, /findAll\s*\(/);
});

test("bulk import UI requires preview before execution and supports atomic mode", async () => {
  const source = await read("../src/pages/party/party-import-dialog.tsx");

  assert.match(source, /previewImport\(/);
  assert.match(source, /service\.import\(/);
  assert.match(source, /\{ atomic \}/);
  assert.match(source, /preview === null/);
  assert.match(source, /atomic && preview\.invalidRows > 0/);
  assert.match(source, /parsePartyCsv/);
  assert.match(source, /parsePartyXlsx/);
  assert.match(source, /createPersistentPartyAuditSink\(database\)/);
});

test("Party selector remains reusable and consumes only the Reader select boundary", async () => {
  const source = await read("../src/components/party/party-selector.tsx");

  assert.match(source, /Pick<PartyReader, "select">/);
  assert.match(source, /reader\s*\.\s*select\(/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Escape/);
  assert.doesNotMatch(source, /SqlitePartyReader/);
  assert.doesNotMatch(source, /getDesktopDatabase/);
});

test("Party errors are localized at the Persian presentation boundary", async () => {
  const source = await read("../src/pages/party/party-error-presenter.ts");

  assert.match(source, /fa-IR/);
  assert.match(source, /party\.code\.conflict/);
  assert.match(source, /party\.identity\.conflict/);
  assert.match(source, /party\.concurrentModification/);
  assert.match(source, /کد ملی/);
  assert.match(source, /شناسه ملی/);
});
