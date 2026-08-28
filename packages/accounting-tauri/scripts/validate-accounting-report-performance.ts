import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { normalizeAccountingReportQuery } from "@argin/accounting/reporting";
import type { AccountingReportExecutionContext } from "@argin/accounting/reporting-application";
import type { DatabaseValue } from "@argin/database";
import {
  createAccountingReportFactSqlQuery,
} from "../src/sqlite-accounting-report-data-reader.ts";

const VALID_VOUCHERS = 20_000;
const NOISE_VOUCHERS = 20_000;
const EXPECTED_LINES = VALID_VOUCHERS * 2;

const context: AccountingReportExecutionContext = Object.freeze({
  kind: "journal",
  query: normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: "IRR",
    branch: { mode: "branch", branchId: "branch-1" },
    period: {
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      fiscalYearId: "fy-1",
      fiscalPeriodId: "fp-1",
    },
    dimensions: [{ dimensionTypeId: "project", memberIds: ["p-1"] }],
  }),
});

const migrationPath = fileURLToPath(new URL(
  "../../../apps/desktop/src-tauri/migrations/0015_accounting_report_indexes.sql",
  import.meta.url,
));

const tempDirectory = mkdtempSync(join(tmpdir(), "argin-phase16-report-performance-"));
const databasePath = join(tempDirectory, "reports.sqlite");

try {
  assertSqliteAvailable();
  const migration = readFileSync(migrationPath, "utf8");
  initializeDatabase(databasePath, migration);

  const query = createAccountingReportFactSqlQuery(context);
  const boundSql = bindSql(query.sql, query.parameters);
  const plan = sqlite(databasePath, `EXPLAIN QUERY PLAN ${boundSql};`);

  assert.match(
    plan,
    /ix_journal_vouchers_reporting_scope/,
    "report query plan must use ix_journal_vouchers_reporting_scope",
  );
  assert.match(
    plan,
    /ix_journal_line_dimensions_reporting/,
    "dimension filter must use ix_journal_line_dimensions_reporting",
  );

  const startedAt = performance.now();
  const countText = sqlite(databasePath, `SELECT COUNT(*) FROM (${boundSql});`).trim();
  const elapsedMs = performance.now() - startedAt;
  const count = Number(countText);

  assert.equal(count, EXPECTED_LINES, "representative report query must return only the in-scope posted lines");

  console.log("Phase 16 SQLite accounting-report performance validation passed.");
  console.log(`Dataset: ${VALID_VOUCHERS + NOISE_VOUCHERS} vouchers / ${(VALID_VOUCHERS + NOISE_VOUCHERS) * 2} journal lines`);
  console.log(`In-scope result: ${count} journal lines`);
  console.log(`Query wall time (including sqlite3 process startup): ${elapsedMs.toFixed(1)} ms`);
  console.log("Query plan:");
  console.log(plan.trim());
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

function assertSqliteAvailable(): void {
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "pipe" });
  } catch {
    throw new Error(
      "sqlite3 CLI is required for Phase 16 query-plan validation. Install/provide sqlite3 and rerun the validation command.",
    );
  }
}

function initializeDatabase(databasePath: string, migration: string): void {
  const schemaAndSeed = `
PRAGMA journal_mode = MEMORY;
PRAGMA synchronous = OFF;
PRAGMA temp_store = MEMORY;

CREATE TABLE journal_vouchers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL,
  voucher_date TEXT NOT NULL,
  branch_id TEXT,
  fiscal_year_id TEXT NOT NULL,
  fiscal_period_id TEXT NOT NULL,
  voucher_number TEXT NOT NULL,
  reference TEXT,
  description TEXT
);

CREATE TABLE journal_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  voucher_id TEXT NOT NULL,
  line_order INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  description TEXT,
  debit_amount INTEGER NOT NULL,
  credit_amount INTEGER NOT NULL
);

CREATE INDEX ix_journal_lines_company_voucher
ON journal_lines(company_id, voucher_id, id);

CREATE TABLE journal_line_dimension_assignments (
  company_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  voucher_id TEXT NOT NULL,
  dimension_type_id TEXT NOT NULL,
  member_id TEXT NOT NULL
);

${migration}

WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < ${VALID_VOUCHERS}
)
INSERT INTO journal_vouchers (
  id, company_id, currency_code, lifecycle_status, voucher_date,
  branch_id, fiscal_year_id, fiscal_period_id, voucher_number, reference, description
)
SELECT
  printf('valid-v-%06d', n), 'company-1', 'IRR', 'posted',
  printf('2026-04-%02d', ((n - 1) % 28) + 1),
  'branch-1', 'fy-1', 'fp-1', CAST(n AS TEXT), NULL, 'valid'
FROM seq;

WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < ${NOISE_VOUCHERS}
)
INSERT INTO journal_vouchers (
  id, company_id, currency_code, lifecycle_status, voucher_date,
  branch_id, fiscal_year_id, fiscal_period_id, voucher_number, reference, description
)
SELECT
  printf('noise-v-%06d', n),
  CASE WHEN n % 2 = 0 THEN 'company-2' ELSE 'company-1' END,
  'IRR',
  CASE WHEN n % 2 = 0 THEN 'posted' ELSE 'draft' END,
  '2026-04-15', 'branch-2', 'fy-1', 'fp-1', CAST(100000 + n AS TEXT), NULL, 'noise'
FROM seq;

INSERT INTO journal_lines (
  id, company_id, voucher_id, line_order, account_id, description, debit_amount, credit_amount
)
SELECT v.id || '-l1', v.company_id, v.id, 1, 'cash', NULL, 100, 0
FROM journal_vouchers v;

INSERT INTO journal_lines (
  id, company_id, voucher_id, line_order, account_id, description, debit_amount, credit_amount
)
SELECT v.id || '-l2', v.company_id, v.id, 2, 'sales', NULL, 0, 100
FROM journal_vouchers v;

INSERT INTO journal_line_dimension_assignments (
  company_id, line_id, voucher_id, dimension_type_id, member_id
)
SELECT l.company_id, l.id, l.voucher_id, 'project',
       CASE WHEN l.voucher_id LIKE 'valid-v-%' THEN 'p-1' ELSE 'p-noise' END
FROM journal_lines l;

ANALYZE;
`;

  sqlite(databasePath, schemaAndSeed);
}

function sqlite(databasePath: string, sql: string): string {
  return execFileSync("sqlite3", [databasePath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function bindSql(sql: string, parameters: readonly DatabaseValue[]): string {
  let index = 0;
  const bound = sql.replace(/\?/g, () => {
    if (index >= parameters.length) {
      throw new Error("Not enough parameters while binding accounting report SQL.");
    }
    return quoteSqlValue(parameters[index++]);
  });
  if (index !== parameters.length) {
    throw new Error("Unused parameters remain after binding accounting report SQL.");
  }
  return bound;
}

function quoteSqlValue(value: DatabaseValue): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}
