import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function sqlite(db: string, sql: string): string {
  const result = spawnSync("sqlite3", [db, sql], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `sqlite3 exited with ${result.status}`);
  return result.stdout.trim();
}

function requirePlan(plan: string, index: string, label: string): void {
  if (!plan.includes(index)) {
    throw new Error(`${label} did not use expected index ${index}.\n${plan}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), "argin-party-perf-"));
const db = join(dir, "party.db");
try {
  sqlite(db, `
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE parties (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, code TEXT NOT NULL,
      classification TEXT NOT NULL, status TEXT NOT NULL, display_name TEXT NOT NULL,
      national_code TEXT, national_id TEXT, economic_number TEXT,
      updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT
    );
    CREATE TABLE party_roles (company_id TEXT NOT NULL, party_id TEXT NOT NULL, role TEXT NOT NULL);
    CREATE UNIQUE INDEX uq_parties_company_national_code ON parties(company_id, national_code) WHERE national_code IS NOT NULL;
    CREATE INDEX ix_parties_company_status_name ON parties(company_id, status, display_name, id);
    CREATE INDEX ix_parties_company_classification_name ON parties(company_id, classification, display_name, id);
    CREATE INDEX ix_party_roles_company_role_party ON party_roles(company_id, role, party_id);
    WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x < 50000)
    INSERT INTO parties(id, company_id, code, classification, status, display_name, national_code, updated_at)
    SELECT printf('p-%06d',x), CASE WHEN x <= 40000 THEN 'company-1' ELSE 'company-noise' END,
           printf('P-%06d',x), CASE WHEN x % 3 = 0 THEN 'legal-entity' ELSE 'natural-person' END,
           CASE WHEN x % 10 = 0 THEN 'inactive' ELSE 'active' END,
           printf('Person %06d',x), CASE WHEN x <= 40000 THEN printf('%010d',x) ELSE NULL END,
           '2026-08-30T00:00:00.000Z' FROM n;
    INSERT INTO party_roles(company_id, party_id, role)
    SELECT company_id, id, CASE WHEN CAST(substr(id,3) AS INTEGER) % 2 = 0 THEN 'customer' ELSE 'supplier' END
    FROM parties WHERE company_id = 'company-1';
    ANALYZE;
  `);

  const listPlan = sqlite(db, "EXPLAIN QUERY PLAN SELECT id, code, display_name FROM parties WHERE company_id='company-1' AND status='active' ORDER BY display_name,id LIMIT 40 OFFSET 400;");
  requirePlan(listPlan, "ix_parties_company_status_name", "Party list");

  const selectorPlan = sqlite(db, "EXPLAIN QUERY PLAN SELECT p.id,p.code,p.display_name FROM parties p WHERE p.company_id='company-1' AND p.status='active' AND EXISTS (SELECT 1 FROM party_roles pr WHERE pr.company_id=p.company_id AND pr.party_id=p.id AND pr.role='customer') ORDER BY p.display_name,p.id LIMIT 20;");
  requirePlan(selectorPlan, "ix_parties_company_status_name", "Party selector");
  requirePlan(selectorPlan, "ix_party_roles_company_role_party", "Party role selector");

  const duplicatePlan = sqlite(db, "EXPLAIN QUERY PLAN SELECT id FROM parties WHERE company_id='company-1' AND national_code='0000001234' LIMIT 1;");
  requirePlan(duplicatePlan, "uq_parties_company_national_code", "Party duplicate lookup");

  const started = performance.now();
  const count = Number(sqlite(db, "SELECT COUNT(*) FROM parties WHERE company_id='company-1' AND status='active';"));
  const elapsedMs = performance.now() - started;
  if (count !== 36000) throw new Error(`Expected 36000 active scoped Parties, got ${count}.`);

  console.log(JSON.stringify({ datasetRows: 50000, scopedRows: 40000, activeScopedRows: count, diagnosticElapsedMs: Math.round(elapsedMs * 100) / 100, indexes: ["ix_parties_company_status_name", "ix_party_roles_company_role_party", "uq_parties_company_national_code"] }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
