import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const migrationNames = [
  "0002_company_and_branch.sql",
  "0003_fiscal_management.sql",
  "0004_security.sql",
  "0005_audit_and_approval.sql",
  "0010_chart_of_accounts.sql",
  "0011_accounting_dimensions.sql",
  "0012_coding_templates.sql",
  "0013_journal_vouchers.sql",
  "0014_journal_lifecycle.sql",
] as const;

const migrations = migrationNames.map((name) =>
  readFileSync(new URL(`../src-tauri/migrations/${name}`, import.meta.url), "utf8"),
);
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const now = "2026-08-24T08:00:00.000Z";

function database(through = migrations.length): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations.slice(0, through)) db.exec(migration);
  return db;
}

function seedVoucherBaseline(db: DatabaseSync): void {
  db.prepare(`INSERT INTO companies (id, code, legal_name, created_at, updated_at)
    VALUES ('company-1', 'C01', 'Argin', ?, ?)`
  ).run(now, now);
  db.prepare(`INSERT INTO fiscal_years (
      id, company_id, code, title, start_date, end_date, status,
      is_current, created_at, updated_at
    ) VALUES ('fy-1', 'company-1', '1405', 'FY', '2026-03-21', '2027-03-20',
      'open', 1, ?, ?)`
  ).run(now, now);
  db.prepare(`INSERT INTO fiscal_periods (
      id, fiscal_year_id, sequence, code, title, start_date, end_date,
      status, created_at, updated_at
    ) VALUES ('period-1', 'fy-1', 1, '01', 'P1', '2026-03-21', '2026-04-20',
      'open', ?, ?)`
  ).run(now, now);
  db.prepare(`INSERT INTO journal_vouchers (
      id, company_id, voucher_number, voucher_date, fiscal_year_id,
      fiscal_period_id, status, total_debit, total_credit, created_at, updated_at, version
    ) VALUES ('voucher-1', 'company-1', '000001', '2026-04-01', 'fy-1',
      'period-1', 'draft', 1000, 1000, ?, ?, 1)`
  ).run(now, now);
}

describe("journal lifecycle migration", () => {
  it("registers migration 14 in the desktop runner", () => {
    assert.match(runner, /version:\s*14/u);
    assert.match(runner, /description:\s*"journal_lifecycle"/u);
    assert.match(runner, /0014_journal_lifecycle\.sql/u);
  });

  it("upgrades existing Phase 13 drafts to lifecycle draft without data loss", () => {
    const db = database(migrations.length - 1);
    seedVoucherBaseline(db);
    db.exec(migrations.at(-1)!);

    const row = db.prepare(`SELECT id, status, lifecycle_status, version
      FROM journal_vouchers WHERE id = 'voucher-1'`).get() as {
        id: string;
        status: string;
        lifecycle_status: string;
        version: number;
      };
    assert.deepEqual(row, {
      id: "voucher-1",
      status: "draft",
      lifecycle_status: "draft",
      version: 1,
    });
  });

  it("accepts only the five lifecycle states", () => {
    const db = database(migrations.length - 1);
    seedVoucherBaseline(db);
    db.exec(migrations.at(-1)!);

    for (const status of ["draft", "pending_approval", "approved", "posted", "reversed"]) {
      db.prepare("UPDATE journal_vouchers SET lifecycle_status = ? WHERE id = 'voucher-1'").run(status);
    }
    assert.throws(() =>
      db.prepare("UPDATE journal_vouchers SET lifecycle_status = 'deleted' WHERE id = 'voucher-1'").run(),
    );
  });

  it("creates lifecycle evidence tables and protective indexes", () => {
    const db = database();
    const names = db.prepare(`SELECT name FROM sqlite_master
      WHERE type IN ('table', 'index') AND name LIKE 'journal_%'`).all() as Array<{ name: string }>;
    const found = new Set(names.map((item) => item.name));

    for (const name of [
      "journal_voucher_approval_cycles",
      "journal_voucher_posting_evidence",
      "journal_voucher_amendment_evidence",
      "journal_voucher_reversal_lineage",
      "uq_journal_approval_cycle_current",
      "uq_journal_reversal_company_request",
      "ix_journal_vouchers_lifecycle_status",
    ]) {
      assert.equal(found.has(name), true, `missing ${name}`);
    }
  });
});
