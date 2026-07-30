import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccount,
  createAccountCodingSettings,
} from "@argin/accounting";
import type {
  DatabaseExecutor,
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";

import {
  SqliteAccountCodingSettingsRepository,
  SqliteAccountingUnitOfWork,
  SqliteAccountRepository,
} from "../src/index.ts";

class FakeDatabase implements DatabaseSession {
  readonly executions: Array<{
    sql: string;
    parameters: readonly DatabaseValue[];
  }> = [];
  rowsAffected = 1;
  queryRows: unknown[] = [];
  queryOneRow: unknown = null;

  async execute(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<DatabaseExecuteResult> {
    this.executions.push({ sql, parameters });
    return { rowsAffected: this.rowsAffected };
  }

  async query<T>(): Promise<T[]> {
    return this.queryRows as T[];
  }

  async queryOne<T>(): Promise<T | null> {
    return this.queryOneRow as T | null;
  }
}

class FakeExecutor extends FakeDatabase implements DatabaseExecutor {
  transactionRuns = 0;

  async transaction<T>(
    operation: (session: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    this.transactionRuns += 1;
    return operation(this);
  }

  async close(): Promise<void> {}
}

const createdAt = "2026-07-30T00:00:00.000Z";

function sampleAccount() {
  return createAccount({
    id: "account-1",
    companyId: "company-1",
    level: "group",
    code: "11",
    name: "دارایی‌ها",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    reportClassification: {
      balanceSheetSection: "assets",
      managementTags: ["مدیریتی", "کلیدی"],
    },
    createdAt,
  });
}

test("account repository creates the account and ordered tags", async () => {
  const database = new FakeDatabase();
  const repository = new SqliteAccountRepository(database);

  await repository.create(sampleAccount());

  assert.equal(database.executions.length, 4);
  assert.match(database.executions[0]!.sql, /INSERT INTO accounts/);
  assert.match(database.executions[1]!.sql, /DELETE FROM account_management_tags/);
  assert.deepEqual(
    database.executions.slice(2).map(({ parameters }) => parameters),
    [
      ["account-1", "مدیریتی", 0],
      ["account-1", "کلیدی", 1],
    ],
  );
});

test("account repository maps report classification and tags", async () => {
  const database = new FakeDatabase();
  database.queryOneRow = {
    id: "account-1", company_id: "company-1", parent_id: null,
    level: "group", code: "11", name: "دارایی‌ها", english_name: null,
    nature: "debit", normal_balance: "debit",
    statement_type: "balance_sheet", balance_sheet_section: "assets",
    income_statement_section: null, cash_flow_category: "operating",
    is_cash_equivalent: 0, is_receivable: 1, is_payable: 0,
    posting_allowed: 0, currency_enabled: 0, revaluation_enabled: 0,
    tracking_enabled: 0, due_date_enabled: 0, status: "active",
    display_order: 0, source_type: "manual", source_reference_id: null,
    created_at: createdAt, updated_at: createdAt, version: 1,
  };
  database.queryRows = [
    { account_id: "account-1", tag: "مدیریتی" },
  ];

  const account =
    await new SqliteAccountRepository(database).findById("account-1");

  assert.equal(account?.reportClassification.receivable, true);
  assert.deepEqual(
    account?.reportClassification.managementTags,
    ["مدیریتی"],
  );
});

test("account lists load management tags without N+1 queries", async () => {
  const database = new FakeDatabase();
  database.queryRows = [
    {
      id: "account-1", company_id: "company-1", parent_id: null,
      level: "group", code: "11", name: "دارایی‌ها", english_name: null,
      nature: "debit", normal_balance: "debit",
      statement_type: "balance_sheet", balance_sheet_section: "assets",
      income_statement_section: null, cash_flow_category: null,
      is_cash_equivalent: 0, is_receivable: 0, is_payable: 0,
      posting_allowed: 0, currency_enabled: 0, revaluation_enabled: 0,
      tracking_enabled: 0, due_date_enabled: 0, status: "active",
      display_order: 0, source_type: "manual", source_reference_id: null,
      created_at: createdAt, updated_at: createdAt, version: 1,
    },
  ];
  let queryCount = 0;
  database.query = async <T>() => {
    queryCount += 1;
    return (queryCount === 1
      ? database.queryRows
      : [{ account_id: "account-1", tag: "کلیدی" }]) as T[];
  };

  const accounts = await new SqliteAccountRepository(database)
    .findByCompanyId("company-1");

  assert.equal(queryCount, 2);
  assert.deepEqual(
    accounts[0]?.reportClassification.managementTags,
    ["کلیدی"],
  );
});

test("account update enforces optimistic concurrency", async () => {
  const database = new FakeDatabase();
  database.rowsAffected = 0;
  const account = { ...sampleAccount(), version: 2 };

  await assert.rejects(
    new SqliteAccountRepository(database).update(account),
    { name: "ConcurrencyConflictError" },
  );
  assert.equal(database.executions.length, 1);
});

test("account delete enforces optimistic concurrency", async () => {
  const database = new FakeDatabase();
  const account = sampleAccount();

  await new SqliteAccountRepository(database).delete(account);

  assert.match(database.executions[0]!.sql, /DELETE FROM accounts/);
  assert.deepEqual(database.executions[0]!.parameters, [
    account.id,
    account.companyId,
    account.version,
  ]);
});

test("coding settings are inserted at version one", async () => {
  const database = new FakeDatabase();
  const settings = createAccountCodingSettings({
    companyId: "company-1",
  });

  await new SqliteAccountCodingSettingsRepository(database).save(settings);

  assert.match(database.executions[0]!.sql, /INSERT INTO account_coding_settings/);
});

test("coding settings map SQLite booleans", async () => {
  const database = new FakeDatabase();
  database.queryOneRow = {
    company_id: "company-1",
    group_code_length: 2,
    general_code_length: 4,
    subsidiary_code_length: 6,
    enforce_hierarchical_codes: 1,
    allow_code_change_after_use: 0,
    version: 3,
  };

  const settings =
    await new SqliteAccountCodingSettingsRepository(database)
      .findByCompanyId("company-1");

  assert.equal(settings?.enforceHierarchicalCodes, true);
  assert.equal(settings?.allowCodeChangeAfterUse, false);
  assert.equal(settings?.version, 3);
});

test("accounting unit of work shares one transactional session", async () => {
  const database = new FakeExecutor();

  await new SqliteAccountingUnitOfWork(database).run(
    async ({ accounts, codingSettings }) => {
      await accounts.create(sampleAccount());
      await codingSettings.save(createAccountCodingSettings({
        companyId: "company-1",
      }));
    },
  );

  assert.equal(database.transactionRuns, 1);
  assert.equal(
    database.executions.some(({ sql }) => sql.includes("INSERT INTO accounts")),
    true,
  );
  assert.equal(
    database.executions.some(
      ({ sql }) => sql.includes("INSERT INTO account_coding_settings"),
    ),
    true,
  );
});
