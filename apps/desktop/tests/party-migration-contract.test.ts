import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Party migrations stay registered in deterministic order", async () => {
  const lib = await read("../src-tauri/src/lib.rs");

  const phase16 = lib.indexOf('version: 16');
  const phase17 = lib.indexOf('version: 17');
  assert.ok(phase16 >= 0);
  assert.ok(phase17 > phase16);
  assert.match(lib, /0016_parties\.sql/);
  assert.match(lib, /0017_party_sync_metadata\.sql/);
});

test("Party schema protects company scope, hard identities and optimistic versions", async () => {
  const migration = await read("../src-tauri/migrations/0016_parties.sql");

  assert.match(migration, /UNIQUE \(company_id, code\)/);
  assert.match(migration, /UNIQUE \(company_id, id\)/);
  assert.match(migration, /uq_parties_company_national_code/);
  assert.match(migration, /uq_parties_company_national_id/);
  assert.match(migration, /uq_parties_company_economic_number/);
  assert.match(migration, /CHECK \(version >= 1\)/);
  assert.match(migration, /fk_party_roles_party_same_company/);
  assert.match(migration, /fk_party_contacts_party_same_company/);
  assert.match(migration, /fk_party_addresses_party_same_company/);
});

test("Party schema contains the indexes used by bounded list, selector and duplicate queries", async () => {
  const migration = await read("../src-tauri/migrations/0016_parties.sql");

  for (const index of [
    "ix_parties_company_status_name",
    "ix_parties_company_classification_name",
    "ix_parties_company_updated",
    "ix_party_roles_company_role_party",
    "ix_party_contacts_lookup",
    "ix_party_addresses_postal"
  ]) {
    assert.ok(migration.includes(index), `missing Party query index ${index}`);
  }
});

test("sync metadata migration keeps deletion separate from active/inactive lifecycle", async () => {
  const migration = await read("../src-tauri/migrations/0017_party_sync_metadata.sql");

  assert.match(migration, /deleted_at/);
  assert.match(migration, /party_external_references/);
  assert.match(migration, /source_system/);
  assert.match(migration, /external_id/);
  assert.doesNotMatch(migration, /status\s*=\s*['\"]deleted['\"]/i);
});
