import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const companyMigrationSql = readFileSync(
  new URL(
    "../src-tauri/migrations/0002_company_and_branch.sql",
    import.meta.url,
  ),
  "utf8",
);

const chartOfAccountsMigrationSql = readFileSync(
  new URL(
    "../src-tauri/migrations/0010_chart_of_accounts.sql",
    import.meta.url,
  ),
  "utf8",
);

const migrationRunnerSource = readFileSync(
  new URL(
    "../src-tauri/src/lib.rs",
    import.meta.url,
  ),
  "utf8",
);

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(companyMigrationSql);
  database.exec(chartOfAccountsMigrationSql);
  return database;
}

function insertCompany(
  database: DatabaseSync,
  id: string,
  code: string,
): void {
  database.prepare(`
    INSERT INTO companies (
      id,
      code,
      legal_name,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    code,
    `Company ${code}`,
    "2026-07-30T08:00:00.000Z",
    "2026-07-30T08:00:00.000Z",
  );
}

function insertAccount(
  database: DatabaseSync,
  input: {
    id: string;
    companyId?: string;
    parentId?: string | null;
    level: "group" | "general" | "subsidiary";
    code: string;
    statementType?: "balance_sheet" | "income_statement";
    postingAllowed?: number;
  },
): void {
  database.prepare(`
    INSERT INTO accounts (
      id,
      company_id,
      parent_id,
      level,
      code,
      name,
      nature,
      normal_balance,
      statement_type,
      posting_allowed,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.companyId ?? "company-1",
    input.parentId ?? null,
    input.level,
    input.code,
    `حساب ${input.code}`,
    "strict_debit",
    "debit",
    input.statementType ?? "balance_sheet",
    input.postingAllowed ?? 0,
    "2026-07-30T08:00:00.000Z",
    "2026-07-30T08:00:00.000Z",
  );
}

describe("chart of accounts migration", () => {
  it("registers migration 10 in the desktop runner", () => {
    assert.match(
      migrationRunnerSource,
      /version:\s*10/u,
    );
    assert.match(
      migrationRunnerSource,
      /description:\s*"chart_of_accounts"/u,
    );
    assert.match(
      migrationRunnerSource,
      /include_str!\("\.\.\/migrations\/0010_chart_of_accounts\.sql"\)/u,
    );
  });

  it("creates settings, the hierarchy, classifications, and tags", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");

    database.prepare(`
      INSERT INTO account_coding_settings (
        company_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?)
    `).run(
      "company-1",
      "2026-07-30T08:00:00.000Z",
      "2026-07-30T08:00:00.000Z",
    );

    insertAccount(database, {
      id: "group-1",
      level: "group",
      code: "11",
    });
    insertAccount(database, {
      id: "general-1",
      parentId: "group-1",
      level: "general",
      code: "1101",
    });
    insertAccount(database, {
      id: "subsidiary-1",
      parentId: "general-1",
      level: "subsidiary",
      code: "110101",
      postingAllowed: 1,
    });

    database.prepare(`
      UPDATE accounts
      SET
        balance_sheet_section = 'assets',
        cash_flow_category = 'cash_and_cash_equivalents',
        is_cash_equivalent = 1
      WHERE id = 'subsidiary-1'
    `).run();

    database.prepare(`
      INSERT INTO account_management_tags (
        account_id,
        tag,
        display_order
      )
      VALUES (?, ?, ?)
    `).run("subsidiary-1", "نقدینگی", 0);

    const account = database.prepare(`
      SELECT
        code,
        balance_sheet_section AS balanceSheetSection,
        is_cash_equivalent AS cashEquivalent
      FROM accounts
      WHERE id = ?
    `).get("subsidiary-1") as {
      code: string;
      balanceSheetSection: string;
      cashEquivalent: number;
    };

    assert.equal(account.code, "110101");
    assert.equal(
      account.balanceSheetSection,
      "assets",
    );
    assert.equal(account.cashEquivalent, 1);
  });

  it("enforces company scope, hierarchy shape, and durable account rules", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertCompany(database, "company-2", "C02");

    insertAccount(database, {
      id: "group-1",
      level: "group",
      code: "11",
    });

    assert.throws(
      () => insertAccount(database, {
        id: "group-duplicate",
        level: "group",
        code: "11",
      }),
      /UNIQUE constraint failed/u,
    );

    assert.throws(
      () => insertAccount(database, {
        id: "general-cross-company",
        companyId: "company-2",
        parentId: "group-1",
        level: "general",
        code: "1101",
      }),
      /FOREIGN KEY constraint failed/u,
    );

    assert.throws(
      () => insertAccount(database, {
        id: "posting-group",
        level: "group",
        code: "12",
        postingAllowed: 1,
      }),
      /CHECK constraint failed/u,
    );

    assert.throws(
      () => insertAccount(database, {
        id: "invalid-code",
        level: "group",
        code: "1A",
      }),
      /CHECK constraint failed/u,
    );
  });

  it("allows independent code lengths only outside hierarchical mode", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertCompany(database, "company-2", "C02");

    database.prepare(`
      INSERT INTO account_coding_settings (
        company_id,
        group_code_length,
        general_code_length,
        subsidiary_code_length,
        enforce_hierarchical_codes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "company-1",
      6,
      4,
      2,
      0,
      "2026-07-30T08:00:00.000Z",
      "2026-07-30T08:00:00.000Z",
    );

    assert.throws(
      () => database.prepare(`
        INSERT INTO account_coding_settings (
          company_id,
          group_code_length,
          general_code_length,
          subsidiary_code_length,
          enforce_hierarchical_codes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        "company-2",
        6,
        4,
        2,
        1,
        "2026-07-30T08:00:00.000Z",
        "2026-07-30T08:00:00.000Z",
      ),
      /CHECK constraint failed/u,
    );
  });

  it("enforces report classification and tag integrity", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertAccount(database, {
      id: "income-1",
      level: "group",
      code: "41",
      statementType: "income_statement",
    });

    assert.throws(
      () => database.prepare(`
        UPDATE accounts
        SET balance_sheet_section = 'assets'
        WHERE id = 'income-1'
      `).run(),
      /CHECK constraint failed/u,
    );

    database.prepare(`
      INSERT INTO account_management_tags (
        account_id,
        tag,
        display_order
      )
      VALUES (?, ?, ?)
    `).run("income-1", "فروش", 0);

    assert.throws(
      () => database.prepare(`
        INSERT INTO account_management_tags (
          account_id,
          tag,
          display_order
        )
        VALUES (?, ?, ?)
      `).run("income-1", "فروش", 1),
      /UNIQUE constraint failed/u,
    );

    database.prepare(`
      DELETE FROM accounts
      WHERE id = 'income-1'
    `).run();

    const tagCount = database.prepare(`
      SELECT COUNT(*) AS count
      FROM account_management_tags
    `).get() as { count: number };

    assert.equal(tagCount.count, 0);
  });
});
