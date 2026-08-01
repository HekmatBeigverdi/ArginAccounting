import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const migrationFiles = [
  "0002_company_and_branch.sql",
  "0010_chart_of_accounts.sql",
  "0011_accounting_dimensions.sql",
] as const;

const migrationSql = migrationFiles.map((fileName) =>
  readFileSync(
    new URL(`../src-tauri/migrations/${fileName}`, import.meta.url),
    "utf8",
  )
);

const migrationRunnerSource = readFileSync(
  new URL("../src-tauri/src/lib.rs", import.meta.url),
  "utf8",
);

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const sql of migrationSql) {
    database.exec(sql);
  }
  return database;
}

function insertCompany(
  database: DatabaseSync,
  id: string,
  code: string,
): void {
  database.prepare(`
    INSERT INTO companies (
      id, code, legal_name, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(id, code, `Company ${code}`, timestamp, timestamp);
}

function insertAccount(
  database: DatabaseSync,
  id: string,
  companyId: string,
  code: string,
): void {
  database.prepare(`
    INSERT INTO accounts (
      id, company_id, level, code, name, nature,
      normal_balance, statement_type, created_at, updated_at
    )
    VALUES (?, ?, 'group', ?, ?, 'debit', 'debit',
            'balance_sheet', ?, ?)
  `).run(id, companyId, code, `Account ${code}`, timestamp, timestamp);
}

function insertDimensionType(
  database: DatabaseSync,
  input: {
    id: string;
    companyId?: string;
    code: string;
    hierarchical?: number;
  },
): void {
  database.prepare(`
    INSERT INTO accounting_dimension_types (
      id, company_id, code, name, hierarchical,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.companyId ?? "company-1",
    input.code,
    `Dimension ${input.code}`,
    input.hierarchical ?? 0,
    timestamp,
    timestamp,
  );
}

function insertMember(
  database: DatabaseSync,
  input: {
    id: string;
    companyId?: string;
    dimensionTypeId: string;
    code: string;
    parentId?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
  },
): void {
  database.prepare(`
    INSERT INTO accounting_dimension_members (
      id, company_id, dimension_type_id, code, name, parent_id,
      valid_from, valid_to, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.companyId ?? "company-1",
    input.dimensionTypeId,
    input.code,
    `Member ${input.code}`,
    input.parentId ?? null,
    input.validFrom ?? null,
    input.validTo ?? null,
    timestamp,
    timestamp,
  );
}

const timestamp = "2026-08-01T08:00:00.000Z";

describe("accounting dimensions migration", () => {
  it("registers migration 11 in the desktop runner", () => {
    assert.match(migrationRunnerSource, /version:\s*11/u);
    assert.match(
      migrationRunnerSource,
      /description:\s*"accounting_dimensions"/u,
    );
    assert.match(
      migrationRunnerSource,
      /include_str!\("\.\.\/migrations\/0011_accounting_dimensions\.sql"\)/u,
    );
  });

  it("creates dimension types, members, and account policies", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertAccount(database, "account-1", "company-1", "11");
    insertDimensionType(database, {
      id: "dimension-type-1",
      code: "COST_CENTER",
      hierarchical: 1,
    });
    insertMember(database, {
      id: "member-1",
      dimensionTypeId: "dimension-type-1",
      code: "CC-01",
      validFrom: "2026-01-01",
    });

    database.prepare(`
      INSERT INTO account_dimension_policies (
        id, company_id, account_id, dimension_type_id,
        requirement, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "policy-1",
      "company-1",
      "account-1",
      "dimension-type-1",
      "required",
      timestamp,
      timestamp,
    );

    const policy = database.prepare(`
      SELECT requirement, version
      FROM account_dimension_policies
      WHERE id = ?
    `).get("policy-1") as { requirement: string; version: number };

    assert.equal(policy.requirement, "required");
    assert.equal(policy.version, 1);
  });

  it("enforces company scope and member parent dimension", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertCompany(database, "company-2", "C02");
    insertDimensionType(database, {
      id: "type-1",
      code: "PROJECT",
      hierarchical: 1,
    });
    insertDimensionType(database, {
      id: "type-2",
      code: "COST_CENTER",
      hierarchical: 1,
    });
    insertMember(database, {
      id: "parent-1",
      dimensionTypeId: "type-1",
      code: "PARENT",
    });

    assert.throws(
      () => insertMember(database, {
        id: "cross-type-child",
        dimensionTypeId: "type-2",
        code: "CHILD",
        parentId: "parent-1",
      }),
      /FOREIGN KEY constraint failed/u,
    );

    assert.throws(
      () => insertMember(database, {
        id: "cross-company-member",
        companyId: "company-2",
        dimensionTypeId: "type-1",
        code: "CROSS",
      }),
      /FOREIGN KEY constraint failed/u,
    );
  });

  it("enforces codes, uniqueness, validity dates, and source rules", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertDimensionType(database, { id: "type-1", code: "PROJECT" });

    assert.throws(
      () => insertDimensionType(database, {
        id: "type-duplicate",
        code: "project",
      }),
      /(?:UNIQUE|CHECK) constraint failed/u,
    );

    assert.throws(
      () => insertMember(database, {
        id: "invalid-dates",
        dimensionTypeId: "type-1",
        code: "P-01",
        validFrom: "2026-12-31",
        validTo: "2026-01-01",
      }),
      /CHECK constraint failed/u,
    );

    assert.throws(
      () => insertMember(database, {
        id: "invalid-calendar-date",
        dimensionTypeId: "type-1",
        code: "P-02",
        validFrom: "2026-02-30",
      }),
      /CHECK constraint failed/u,
    );

    assert.throws(
      () => database.prepare(`
        INSERT INTO accounting_dimension_types (
          id, company_id, code, name, source,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'system', ?, ?)
      `).run(
        "system-without-reference",
        "company-1",
        "SYSTEM_DIMENSION",
        "System dimension",
        timestamp,
        timestamp,
      ),
      /CHECK constraint failed/u,
    );
  });

  it("enforces policy uniqueness, values, and same-company references", () => {
    const database = createDatabase();
    insertCompany(database, "company-1", "C01");
    insertCompany(database, "company-2", "C02");
    insertAccount(database, "account-1", "company-1", "11");
    insertAccount(database, "account-2", "company-2", "21");
    insertDimensionType(database, { id: "type-1", code: "PROJECT" });

    const insertPolicy = (
      id: string,
      accountId: string,
      requirement: string,
    ) => database.prepare(`
      INSERT INTO account_dimension_policies (
        id, company_id, account_id, dimension_type_id,
        requirement, created_at, updated_at
      )
      VALUES (?, 'company-1', ?, 'type-1', ?, ?, ?)
    `).run(id, accountId, requirement, timestamp, timestamp);

    insertPolicy("policy-1", "account-1", "optional");

    assert.throws(
      () => insertPolicy("policy-duplicate", "account-1", "required"),
      /UNIQUE constraint failed/u,
    );
    assert.throws(
      () => insertPolicy("policy-invalid", "account-1", "sometimes"),
      /CHECK constraint failed/u,
    );
    assert.throws(
      () => insertPolicy("policy-cross-company", "account-2", "required"),
      /FOREIGN KEY constraint failed/u,
    );
  });
});
