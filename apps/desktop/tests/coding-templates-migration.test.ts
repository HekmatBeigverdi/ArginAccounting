import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const files = [
  "0002_company_and_branch.sql",
  "0010_chart_of_accounts.sql",
  "0011_accounting_dimensions.sql",
  "0012_coding_templates.sql",
] as const;
const sql = files.map((name) => readFileSync(
  new URL(`../src-tauri/migrations/${name}`, import.meta.url), "utf8",
));
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const now = "2026-08-03T10:00:00.000Z";
const fingerprint = "a".repeat(64);

function database(through = sql.length): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of sql.slice(0, through)) db.exec(migration);
  return db;
}

function company(db: DatabaseSync): void {
  db.prepare(`INSERT INTO companies (id, code, legal_name, created_at, updated_at)
    VALUES ('company-1', 'C01', 'Argin', ?, ?)`
  ).run(now, now);
}

function publishedTemplate(db: DatabaseSync): void {
  db.prepare(`INSERT INTO coding_templates (
    id, code, persian_name, activity_type, ownership, lifecycle,
    latest_published_version, created_at, updated_at, version
  ) VALUES ('template-1', 'SERVICE_DEFAULT', 'خدماتی', 'service', 'built_in',
    'published', 1, ?, ?, 2)`).run(now, now);
  db.prepare(`INSERT INTO coding_template_versions (
    id, template_id, template_code, version_number, persian_name,
    activity_type, ownership, source_type, contract_version,
    content_fingerprint, published_at, published_by
  ) VALUES ('version-1', 'template-1', 'SERVICE_DEFAULT', 1, 'خدماتی',
    'service', 'built_in', 'catalog', '1.0', ?, ?, 'system')`
  ).run(fingerprint, now);
}

describe("coding templates migration", () => {
  it("registers migration 12 in the desktop runner", () => {
    assert.match(runner, /version:\s*12/u);
    assert.match(runner, /description:\s*"coding_templates"/u);
    assert.match(runner, /0012_coding_templates\.sql/u);
  });

  it("upgrades a Phase 11 company with custom activity", () => {
    const db = database(3);
    company(db);
    db.exec(sql[3]!);
    const row = db.prepare("SELECT activity_type FROM companies WHERE id = 'company-1'").get() as { activity_type: string };
    assert.equal(row.activity_type, "custom");
    assert.throws(() => db.exec("UPDATE companies SET activity_type = 'invalid'"));
  });

  it("persists normalized version content and provenance", () => {
    const db = database();
    company(db);
    publishedTemplate(db);
    db.prepare(`INSERT INTO coding_template_accounts (
      template_version_id, logical_key, level, code, persian_name, nature,
      normal_balance, statement_type, report_classification_json,
      posting_allowed, currency_enabled, revaluation_enabled, tracking_enabled,
      due_date_enabled, active_by_default, display_order
    ) VALUES ('version-1', 'assets', 'group', '10', 'دارایی‌ها', 'debit',
      'debit', 'balance_sheet', '{}', 0, 0, 0, 0, 0, 1, 0)`
    ).run();
    db.prepare(`INSERT INTO coding_template_imports (
      id, import_key, file_name, file_fingerprint, contract_version, status,
      template_id, template_version_id, actor_id, created_at, completed_at
    ) VALUES ('import-1', 'batch-1', 'coding.xlsx', ?, '1.0', 'published',
      'template-1', 'version-1', 'admin', ?, ?)`
    ).run(fingerprint, now, now);
    const count = db.prepare("SELECT count(*) AS count FROM coding_template_accounts").get() as { count: number };
    assert.equal(count.count, 1);
  });

  it("enforces immutable version scope, idempotency, and lifecycle", () => {
    const db = database();
    company(db);
    publishedTemplate(db);
    assert.throws(() => db.exec(`INSERT INTO coding_template_versions (
      id, template_id, template_code, version_number, persian_name,
      activity_type, ownership, source_type, contract_version,
      content_fingerprint, published_at, published_by
    ) VALUES ('version-2', 'template-1', 'SERVICE_DEFAULT', 1, 'تکراری',
      'service', 'built_in', 'catalog', '1.0', '${fingerprint}', '${now}', 'system')`));
    assert.throws(() => db.exec(`INSERT INTO coding_template_imports (
      id, import_key, file_name, file_fingerprint, contract_version, status, created_at
    ) VALUES ('bad', 'batch', 'bad.xlsx', '${fingerprint}', '1.0', 'published', '${now}')`));
    assert.throws(() => db.exec(`INSERT INTO coding_templates (
      id, code, persian_name, activity_type, ownership, lifecycle,
      created_at, updated_at
    ) VALUES ('bad', 'BAD', 'بد', 'custom', 'custom', 'published', '${now}', '${now}')`));
  });

  it("rejects cross-version item references", () => {
    const db = database();
    company(db);
    publishedTemplate(db);
    assert.throws(() => db.exec(`INSERT INTO coding_template_account_dimension_policies
      (template_version_id, account_logical_key, dimension_type_logical_key, requirement)
      VALUES ('version-1', 'missing-account', 'missing-type', 'required')`));
  });
});
