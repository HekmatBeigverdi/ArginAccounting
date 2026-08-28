import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAccountingReportQuery } from "@argin/accounting/reporting";
import type { AccountingReportExecutionContext } from "@argin/accounting/reporting-application";
import type { DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  createAccountingReportAssignmentSqlQuery,
  createAccountingReportFactSqlQuery,
  SqliteAccountingReportDataReader,
} from "../src/sqlite-accounting-report-data-reader.ts";

class FakeDatabase implements DatabaseSession {
  readonly calls: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];

  constructor(private readonly factCount = 1) {}

  async execute(): Promise<DatabaseExecuteResult> {
    return { rowsAffected: 0 } as DatabaseExecuteResult;
  }

  async queryOne<T>(): Promise<T | null> {
    return null;
  }

  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    this.calls.push({ sql, parameters });

    if (sql.includes("FROM accounts WHERE company_id")) {
      return [{
        id: "cash", company_id: "company-1", parent_id: null,
        level: "subsidiary", code: "101", name: "Cash", english_name: null,
        nature: "uncontrolled", normal_balance: "debit", statement_type: "balance_sheet",
        balance_sheet_section: null, income_statement_section: null, cash_flow_category: null,
        is_cash_equivalent: 0, is_receivable: 0, is_payable: 0,
        posting_allowed: 1, currency_enabled: 0, revaluation_enabled: 0,
        tracking_enabled: 0, due_date_enabled: 0, status: "active", display_order: 1,
        source_type: "manual", source_reference_id: null,
        created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", version: 1,
      }] as T[];
    }
    if (sql.includes("FROM account_management_tags")) return [];

    if (sql.includes("SELECT a.line_id")) {
      return Array.from({ length: this.factCount }, (_, index) => ({
        line_id: `line-${index + 1}`,
        dimension_type_id: "project",
        member_id: "p-1",
      })) as T[];
    }

    if (sql.includes("FROM journal_vouchers v") && sql.includes("JOIN journal_lines l")) {
      return Array.from({ length: this.factCount }, (_, index) => ({
        company_id: "company-1", currency_code: "IRR", branch_id: "branch-1",
        fiscal_year_id: "fy-1", fiscal_period_id: "fp-1",
        voucher_id: `voucher-${index + 1}`, journal_line_id: `line-${index + 1}`, voucher_date: "2026-04-10",
        voucher_number: String(index + 1), voucher_reference: `REF-${index + 1}`, voucher_description: "Voucher",
        line_order: 1, account_id: "cash", line_description: "Line", debit_amount: 100, credit_amount: 0,
      })) as T[];
    }

    if (sql.includes("FROM accounting_dimension_types")) {
      return [{
        id: "project", company_id: "company-1", code: "PRJ", name: "Project",
        english_name: null, hierarchical: 0, allow_multiple_members: 0, status: "active",
        display_order: 1, source: "manual", source_reference_id: null,
        created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", version: 1,
      }] as T[];
    }

    if (sql.includes("FROM accounting_dimension_members")) {
      return [{
        id: "p-1", company_id: "company-1", dimension_type_id: "project",
        code: "P1", name: "Project 1", english_name: null, parent_id: null, status: "active",
        valid_from: null, valid_to: null, display_order: 1, source: "manual", source_reference_id: null,
        created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", version: 1,
      }] as T[];
    }

    return [];
  }
}

function context(
  kind: AccountingReportExecutionContext["kind"],
  branch: { mode: "branch"; branchId: string } | { mode: "all" } = { mode: "branch", branchId: "branch-1" },
): AccountingReportExecutionContext {
  return Object.freeze({
    kind,
    query: normalizeAccountingReportQuery({
      companyId: "company-1",
      currency: "IRR",
      branch,
      period: { fromDate: "2026-04-01", toDate: "2026-04-30", fiscalYearId: "fy-1", fiscalPeriodId: "fp-1" },
      dimensions: [{ dimensionTypeId: "project", memberIds: ["p-1"] }],
    }),
  });
}

test("reads canonical journal facts with posted/reversed scope and generic dimension EXISTS filtering", async () => {
  const database = new FakeDatabase();
  const reader = new SqliteAccountingReportDataReader(database);

  const snapshot = await reader.read(context("general-ledger"));

  assert.equal(snapshot.accounts.length, 1);
  assert.equal(snapshot.balanceFacts.length, 1);
  assert.equal(snapshot.ledgerFacts.length, 1);
  assert.equal(snapshot.journalFacts.length, 0);
  assert.deepEqual(snapshot.balanceFacts[0]!.dimensions, [
    { dimensionTypeId: "project", memberId: "p-1" },
  ]);

  const factQuery = database.calls.find((call) =>
    call.sql.includes("FROM journal_vouchers v") && call.sql.includes("JOIN journal_lines l"));
  assert.ok(factQuery);
  assert.match(factQuery.sql, /lifecycle_status IN \('posted', 'reversed'\)/);
  assert.match(factQuery.sql, /v\.voucher_date <= \?/);
  assert.match(factQuery.sql, /v\.branch_id = \?/);
  assert.match(factQuery.sql, /v\.fiscal_year_id = \?/);
  assert.match(factQuery.sql, /EXISTS/);
  assert.doesNotMatch(factQuery.sql, /v\.fiscal_period_id = \?/);
});

test("loads dimension metadata only for the dimension report kind", async () => {
  const database = new FakeDatabase();
  const reader = new SqliteAccountingReportDataReader(database);

  const snapshot = await reader.read(context("dimensions"));

  assert.equal(snapshot.dimensionTypes.length, 1);
  assert.equal(snapshot.dimensionMembers.length, 1);
  assert.equal(snapshot.dimensionTypes[0]!.id, "project");
  assert.equal(snapshot.dimensionMembers[0]!.id, "p-1");
});

test("maps journal detail fields without loading unrelated detail projections", async () => {
  const database = new FakeDatabase();
  const reader = new SqliteAccountingReportDataReader(database);

  const snapshot = await reader.read(context("journal"));

  assert.equal(snapshot.balanceFacts.length, 1);
  assert.equal(snapshot.ledgerFacts.length, 0);
  assert.equal(snapshot.journalFacts.length, 1);
  assert.equal(snapshot.journalFacts[0]!.voucherReference, "REF-1");
  assert.equal(snapshot.journalFacts[0]!.voucherNumber, "1");
  assert.equal(snapshot.journalFacts[0]!.lineOrder, 1);
});

test("all-branches SQL does not accidentally narrow to a branch while exact branch does", () => {
  const allBranches = createAccountingReportFactSqlQuery(context("trial-balance", { mode: "all" }));
  const exactBranch = createAccountingReportFactSqlQuery(context("trial-balance"));

  assert.doesNotMatch(allBranches.sql, /v\.branch_id = \?/);
  assert.equal(allBranches.parameters.includes("branch-1"), false);
  assert.match(exactBranch.sql, /v\.branch_id = \?/);
  assert.equal(exactBranch.parameters.includes("branch-1"), true);
});

test("fact and assignment queries preserve identical report scope parameters", () => {
  const reportContext = context("journal");
  const factQuery = createAccountingReportFactSqlQuery(reportContext);
  const assignmentQuery = createAccountingReportAssignmentSqlQuery(reportContext);

  assert.deepEqual(assignmentQuery.parameters, factQuery.parameters);
  assert.match(factQuery.sql, /ORDER BY v\.voucher_date, v\.voucher_number, v\.id, l\.line_order, l\.id/);
  assert.match(assignmentQuery.sql, /ORDER BY a\.line_id, a\.dimension_type_id, a\.member_id/);
});

test("representative larger snapshot uses fixed set-based query count rather than per-line N+1", async () => {
  const database = new FakeDatabase(5_000);
  const reader = new SqliteAccountingReportDataReader(database);

  const snapshot = await reader.read(context("journal"));

  assert.equal(snapshot.balanceFacts.length, 5_000);
  assert.equal(snapshot.journalFacts.length, 5_000);
  assert.equal(snapshot.balanceFacts[4_999]!.dimensions?.[0]?.memberId, "p-1");

  const factReads = database.calls.filter((call) =>
    call.sql.includes("FROM journal_vouchers v") && call.sql.includes("JOIN journal_lines l") && !call.sql.includes("journal_line_dimension_assignments a"));
  const assignmentReads = database.calls.filter((call) => call.sql.includes("SELECT a.line_id"));
  assert.equal(factReads.length, 1);
  assert.equal(assignmentReads.length, 1);
});
