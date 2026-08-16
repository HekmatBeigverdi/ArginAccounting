import assert from "node:assert/strict";
import test from "node:test";

import { createJournalVoucher } from "@argin/accounting/journal";
import type {
  DatabaseExecutor,
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";

import {
  SqliteJournalVoucherRepository,
  SqliteJournalVoucherUnitOfWork,
  SqliteJournalVoucherUsageReader,
} from "../src/index.ts";

class FakeDatabase implements DatabaseSession {
  readonly executions: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  readonly queries: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];
  rowsAffected = 1;
  voucherRow: unknown = null;
  lineRows: unknown[] = [];
  dimensionRows: unknown[] = [];
  countRow: unknown = { count: 0 };
  searchRows: unknown[] = [];
  existsRow: unknown = null;

  async execute(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<DatabaseExecuteResult> {
    this.executions.push({ sql, parameters });
    return { rowsAffected: this.rowsAffected };
  }

  async query<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T[]> {
    this.queries.push({ sql, parameters });
    if (sql.includes("journal_line_dimension_assignments")) return this.dimensionRows as T[];
    if (sql.includes("FROM journal_lines")) return this.lineRows as T[];
    if (sql.includes("SELECT v.*")) return this.searchRows as T[];
    return [];
  }

  async queryOne<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T | null> {
    this.queries.push({ sql, parameters });
    if (sql.includes("COUNT(*)")) return this.countRow as T;
    if (sql.includes("SELECT 1 AS found")) return this.existsRow as T | null;
    if (sql.includes("journal_vouchers")) return this.voucherRow as T | null;
    return null;
  }
}

class FakeExecutor extends FakeDatabase implements DatabaseExecutor {
  transactionRuns = 0;
  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    this.transactionRuns += 1;
    return operation(this);
  }
  async close(): Promise<void> {}
}

const createdAt = "2026-08-16T05:00:00.000Z";

function voucher(version = 1) {
  return createJournalVoucher({
    id: "voucher-1",
    companyId: "company-1",
    number: "000001",
    voucherDate: "2026-08-16",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    createdAt,
    version,
    lines: [
      {
        id: "line-1", order: 1, accountId: "account-1",
        debit: 1000, credit: 0,
        dimensionAssignments: [{ dimensionTypeId: "type-1", memberIds: ["member-1"] }],
      },
      { id: "line-2", order: 2, accountId: "account-2", debit: 0, credit: 1000 },
    ],
  });
}

function persistedVoucherRow(version = 1) {
  return {
    id: "voucher-1", company_id: "company-1", branch_id: null,
    voucher_number: "000001", reference: null, voucher_date: "2026-08-16",
    fiscal_year_id: "fy-1", fiscal_period_id: "fp-1", description: null,
    status: "draft", currency_code: "IRR", source_type: "manual",
    source_id: null, request_id: null, correlation_id: null, causation_id: null,
    total_debit: 1000, total_credit: 1000, created_at: createdAt,
    updated_at: "2026-08-16T05:30:00.000Z", version,
  };
}

function balancedLineRows(amount = 1000) {
  return [
    { id: "line-1", voucher_id: "voucher-1", line_order: 1, account_id: "account-1", description: null, debit_amount: amount, credit_amount: 0 },
    { id: "line-2", voucher_id: "voucher-1", line_order: 2, account_id: "account-2", description: null, debit_amount: 0, credit_amount: amount },
  ];
}

test("journal repository persists aggregate, lines, and dimensions", async () => {
  const db = new FakeDatabase();
  await new SqliteJournalVoucherRepository(db).create(voucher());
  assert.equal(db.executions.filter(({ sql }) => sql.includes("INSERT INTO journal_vouchers")).length, 1);
  assert.equal(db.executions.filter(({ sql }) => sql.includes("INSERT INTO journal_lines")).length, 2);
  assert.equal(db.executions.filter(({ sql }) => sql.includes("journal_line_dimension_assignments")).length, 1);
});

test("journal repository rehydrates through domain invariants and preserves metadata", async () => {
  const db = new FakeDatabase();
  db.voucherRow = persistedVoucherRow();
  db.lineRows = balancedLineRows();
  db.dimensionRows = [{ line_id: "line-1", dimension_type_id: "type-1", member_id: "member-1" }];
  const result = await new SqliteJournalVoucherRepository(db).findById("voucher-1");
  assert.equal(result?.totalDebit.amount, 1000);
  assert.equal(result?.lines[0]?.dimensionAssignments[0]?.memberIds[0], "member-1");
  assert.equal(result?.updatedAt, "2026-08-16T05:30:00.000Z");
});

test("journal repository rejects persisted header totals that drift from balanced lines", async () => {
  const db = new FakeDatabase();
  db.voucherRow = persistedVoucherRow();
  db.lineRows = balancedLineRows(900);

  await assert.rejects(
    () => new SqliteJournalVoucherRepository(db).findById("voucher-1"),
    /Persisted JournalVoucher totals do not match its lines/u,
  );
});

test("journal repository rejects a stale optimistic update", async () => {
  const db = new FakeDatabase();
  db.rowsAffected = 0;
  await assert.rejects(() =>
    new SqliteJournalVoucherRepository(db).update(voucher(2), 1)
  );
  assert.equal(db.executions.length, 1);
});

test("journal search escapes LIKE wildcard characters and remains paged", async () => {
  const db = new FakeDatabase();
  db.countRow = { count: 0 };
  const result = await new SqliteJournalVoucherRepository(db).search({
    companyId: "company-1", branchId: undefined, fiscalYearId: undefined,
    fiscalPeriodId: undefined, accountId: undefined, sourceType: undefined,
    reference: undefined, number: undefined, dateFrom: undefined, dateTo: undefined,
    text: "100%_\\", page: 1, pageSize: 25, offset: 0,
  });
  const select = db.queries.find(({ sql }) => sql.includes("SELECT v.*"));
  assert.ok(select);
  assert.match(select.sql, /ESCAPE '\\'/u);
  assert.equal(select.parameters[1], "%100\\%\\_\\\\%");
  assert.equal(result.totalItems, 0);
});

test("journal usage reader checks persisted line and dimension references", async () => {
  const db = new FakeDatabase();
  db.existsRow = { found: 1 };
  const usage = new SqliteJournalVoucherUsageReader(db);
  assert.equal(await usage.isAccountUsed("account-1"), true);
  assert.equal(await usage.isDimensionTypeUsed("type-1"), true);
  assert.equal(await usage.isDimensionMemberUsed("member-1"), true);
});

test("journal unit of work uses one transaction and propagates failure for rollback", async () => {
  const db = new FakeExecutor();
  const uow = new SqliteJournalVoucherUnitOfWork(db);
  await assert.rejects(
    () => uow.run(async ({ journals }) => {
      await journals.create(voucher());
      throw new Error("rollback");
    }),
    /rollback/u,
  );
  assert.equal(db.transactionRuns, 1);
});
