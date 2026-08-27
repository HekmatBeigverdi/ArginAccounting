import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAccountingReportQuery } from "@argin/accounting/reporting";
import type { AccountingReportExecutionContext } from "@argin/accounting/reporting-application";
import type { DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteAccountingReportDataReader } from "../src/sqlite-accounting-report-data-reader.ts";

class FakeDatabase implements DatabaseSession {
  readonly calls: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];

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
      return [{ line_id: "line-1", dimension_type_id: "project", member_id: "p-1" }] as T[];
    }

    if (sql.includes("FROM journal_vouchers v") && sql.includes("JOIN journal_lines l")) {
      return [{
        company_id: "company-1", currency_code: "IRR", branch_id: "branch-1",
        fiscal_year_id: "fy-1", fiscal_period_id: "fp-1",
        voucher_id: "voucher-1", journal_line_id: "line-1", voucher_date: "2026-04-10",
        voucher_number: "10", voucher_reference: "REF-10", voucher_description: "Voucher",
        line_order: 1, account_id: "cash", line_description: "Line", debit_amount: 100, credit_amount: 0,
      }] as T[];
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

function context(kind: AccountingReportExecutionContext["kind"]): AccountingReportExecutionContext {
  return Object.freeze({
    kind,
    query: normalizeAccountingReportQuery({
      companyId: "company-1",
      currency: "IRR",
      branch: { mode: "branch", branchId: "branch-1" },
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
  assert.equal(snapshot.journalFacts[0]!.voucherReference, "REF-10");
  assert.equal(snapshot.journalFacts[0]!.voucherNumber, "10");
  assert.equal(snapshot.journalFacts[0]!.lineOrder, 1);
});
