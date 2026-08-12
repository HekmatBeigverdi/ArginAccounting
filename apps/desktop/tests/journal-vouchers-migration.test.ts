import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const files = [
  "0002_company_and_branch.sql",
  "0003_fiscal_management.sql",
  "0010_chart_of_accounts.sql",
  "0011_accounting_dimensions.sql",
  "0012_coding_templates.sql",
  "0013_journal_vouchers.sql",
] as const;

const sql = files.map((name) =>
  readFileSync(new URL(`../src-tauri/migrations/${name}`, import.meta.url), "utf8"),
);
const runner = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const now = "2026-08-12T16:25:00.000Z";

function database(through = sql.length): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of sql.slice(0, through)) db.exec(migration);
  return db;
}

function seedBaseline(db: DatabaseSync): void {
  db.prepare(`INSERT INTO companies (id, code, legal_name, created_at, updated_at)
    VALUES ('company-1', 'C01', 'Argin', ?, ?)`
  ).run(now, now);

  db.prepare(`INSERT INTO branches (id, company_id, code, name, created_at, updated_at)
    VALUES ('branch-1', 'company-1', 'B01', 'Main', ?, ?)`
  ).run(now, now);

  db.prepare(`INSERT INTO fiscal_years (
      id, company_id, code, title, start_date, end_date, status,
      is_current, created_at, updated_at
    ) VALUES (
      'fy-1', 'company-1', '1405', 'FY 1405', '2026-03-21', '2027-03-20',
      'open', 1, ?, ?
    )`
  ).run(now, now);

  db.prepare(`INSERT INTO fiscal_periods (
      id, fiscal_year_id, sequence, code, title, start_date, end_date,
      status, created_at, updated_at
    ) VALUES (
      'period-1', 'fy-1', 1, '01', 'Period 1', '2026-03-21', '2026-04-20',
      'open', ?, ?
    )`
  ).run(now, now);

  db.prepare(`INSERT INTO accounts (
      id, company_id, parent_id, level, code, name, nature, normal_balance,
      statement_type, posting_allowed, status, created_at, updated_at
    ) VALUES
      ('group-1', 'company-1', NULL, 'group', '10', 'Assets', 'debit', 'debit',
       'balance_sheet', 0, 'active', ?, ?),
      ('general-1', 'company-1', 'group-1', 'general', '1001', 'Cash General',
       'debit', 'debit', 'balance_sheet', 0, 'active', ?, ?),
      ('account-1', 'company-1', 'general-1', 'subsidiary', '100101', 'Cash',
       'debit', 'debit', 'balance_sheet', 1, 'active', ?, ?),
      ('account-2', 'company-1', 'general-1', 'subsidiary', '100102', 'Bank',
       'debit', 'debit', 'balance_sheet', 1, 'active', ?, ?)`
  ).run(now, now, now, now, now, now, now, now);

  db.prepare(`INSERT INTO accounting_dimension_types (
      id, company_id, code, name, hierarchical, allow_multiple_members,
      status, created_at, updated_at
    ) VALUES ('dim-1', 'company-1', 'COST_CENTER', 'Cost Center', 0, 0, 'active', ?, ?)`
  ).run(now, now);

  db.prepare(`INSERT INTO accounting_dimension_members (
      id, company_id, dimension_type_id, code, name, status, created_at, updated_at
    ) VALUES ('member-1', 'company-1', 'dim-1', 'CC01', 'HQ', 'active', ?, ?)`
  ).run(now, now);
}

function insertVoucher(db: DatabaseSync, id = "voucher-1", number = "000001"): void {
  db.prepare(`INSERT INTO journal_vouchers (
      id, company_id, branch_id, voucher_number, voucher_date,
      fiscal_year_id, fiscal_period_id, status, currency_code, source_type,
      total_debit, total_credit, created_at, updated_at, version
    ) VALUES (?, 'company-1', 'branch-1', ?, '2026-04-01',
      'fy-1', 'period-1', 'draft', 'IRR', 'manual', 1000, 1000, ?, ?, 1)`
  ).run(id, number, now, now);
}

describe("journal vouchers migration", () => {
  it("registers migration 13 in the desktop runner", () => {
    assert.match(runner, /version:\s*13/u);
    assert.match(runner, /description:\s*"journal_vouchers"/u);
    assert.match(runner, /0013_journal_vouchers\.sql/u);
  });

  it("upgrades a Phase 12 database without changing existing data", () => {
    const db = database(5);
    seedBaseline(db);
    const before = db.prepare("SELECT count(*) AS count FROM accounts").get() as { count: number };
    db.exec(sql[5]!);
    const after = db.prepare("SELECT count(*) AS count FROM accounts").get() as { count: number };
    assert.equal(after.count, before.count);
    assert.equal(
      (db.prepare("SELECT count(*) AS count FROM journal_vouchers").get() as { count: number }).count,
      0,
    );
  });

  it("persists a balanced voucher, ordered lines, and dimension assignments", () => {
    const db = database();
    seedBaseline(db);
    insertVoucher(db);

    db.prepare(`INSERT INTO journal_lines (
      id, voucher_id, company_id, line_order, account_id,
      debit_amount, credit_amount, currency_code
    ) VALUES
      ('line-1', 'voucher-1', 'company-1', 1, 'account-1', 1000, 0, 'IRR'),
      ('line-2', 'voucher-1', 'company-1', 2, 'account-2', 0, 1000, 'IRR')`
    ).run();

    db.prepare(`INSERT INTO journal_line_dimension_assignments (
      voucher_id, line_id, company_id, dimension_type_id, member_id
    ) VALUES ('voucher-1', 'line-1', 'company-1', 'dim-1', 'member-1')`
    ).run();

    const count = db.prepare("SELECT count(*) AS count FROM journal_lines").get() as { count: number };
    assert.equal(count.count, 2);
  });

  it("enforces voucher number uniqueness inside company/fiscal/branch scope", () => {
    const db = database();
    seedBaseline(db);
    insertVoucher(db, "voucher-1", "000001");
    assert.throws(() => insertVoucher(db, "voucher-2", "000001"));
  });

  it("rejects unbalanced voucher totals and invalid journal line sides", () => {
    const db = database();
    seedBaseline(db);

    assert.throws(() =>
      db.prepare(`INSERT INTO journal_vouchers (
        id, company_id, voucher_number, voucher_date, fiscal_year_id,
        fiscal_period_id, total_debit, total_credit, created_at, updated_at
      ) VALUES ('bad-voucher', 'company-1', '000099', '2026-04-01', 'fy-1',
        'period-1', 1000, 900, ?, ?)`
      ).run(now, now),
    );

    insertVoucher(db);
    assert.throws(() =>
      db.prepare(`INSERT INTO journal_lines (
        id, voucher_id, company_id, line_order, account_id,
        debit_amount, credit_amount, currency_code
      ) VALUES ('bad-line', 'voucher-1', 'company-1', 1, 'account-1', 100, 100, 'IRR')`
      ).run(),
    );
  });

  it("rejects cross-company account and invalid dimension-member references", () => {
    const db = database();
    seedBaseline(db);
    insertVoucher(db);

    assert.throws(() =>
      db.prepare(`INSERT INTO journal_lines (
        id, voucher_id, company_id, line_order, account_id,
        debit_amount, credit_amount, currency_code
      ) VALUES ('missing-account', 'voucher-1', 'company-1', 1, 'account-missing', 1000, 0, 'IRR')`
      ).run(),
    );

    db.prepare(`INSERT INTO journal_lines (
      id, voucher_id, company_id, line_order, account_id,
      debit_amount, credit_amount, currency_code
    ) VALUES ('line-1', 'voucher-1', 'company-1', 1, 'account-1', 1000, 0, 'IRR')`
    ).run();

    assert.throws(() =>
      db.prepare(`INSERT INTO journal_line_dimension_assignments (
        voucher_id, line_id, company_id, dimension_type_id, member_id
      ) VALUES ('voucher-1', 'line-1', 'company-1', 'dim-1', 'missing-member')`
      ).run(),
    );
  });
});
