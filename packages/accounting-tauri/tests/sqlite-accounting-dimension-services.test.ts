import assert from "node:assert/strict";
import test from "node:test";
import { AccountingDimensionAssignmentValidationError } from "@argin/accounting";
import type {
  DatabaseExecutor,
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import {
  SqliteAccountingDimensionAssignmentValidationService,
  SqliteAccountingDimensionUsageReader,
} from "../src/index.ts";

interface DatabaseCall {
  readonly sql: string;
  readonly parameters: readonly DatabaseValue[];
}

type QueryHandler = (
  sql: string,
  parameters: readonly DatabaseValue[],
) => readonly unknown[];

class FakeDatabase implements DatabaseExecutor, DatabaseSession {
  readonly queries: DatabaseCall[] = [];
  transactionRuns = 0;

  constructor(private readonly queryHandler: QueryHandler) {}

  async execute(): Promise<DatabaseExecuteResult> {
    return { rowsAffected: 0 };
  }

  async query<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T[]> {
    this.queries.push({ sql, parameters });
    return [...this.queryHandler(sql, parameters)] as T[];
  }

  async queryOne<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T | null> {
    this.queries.push({ sql, parameters });
    return (this.queryHandler(sql, parameters)[0] ?? null) as T | null;
  }

  async transaction<T>(
    operation: (session: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    this.transactionRuns += 1;
    return operation(this);
  }

  async close(): Promise<void> {}
}

const now = "2026-08-01T00:00:00.000Z";

test("usage reader scopes dimension type dependencies to the company", async () => {
  const database = new FakeDatabase((sql, parameters) => {
    if (
      sql.includes("accounting_dimension_members") &&
      parameters[0] === "company-1"
    ) {
      return [];
    }

    if (
      sql.includes("account_dimension_policies") &&
      parameters[0] === "company-1"
    ) {
      return [{ found: 1 }];
    }

    return [];
  });
  const usageReader = new SqliteAccountingDimensionUsageReader(database);

  assert.equal(
    await usageReader.isDimensionTypeInUse("company-1", "type-1"),
    true,
  );
  assert.equal(database.transactionRuns, 1);
  assert.deepEqual(database.queries[0]?.parameters, ["company-1", "type-1"]);
  assert.deepEqual(database.queries[1]?.parameters, ["company-1", "type-1"]);
});

test("usage reader stops after finding a dimension member dependency", async () => {
  const database = new FakeDatabase((sql) =>
    sql.includes("accounting_dimension_members") ? [{ found: 1 }] : [],
  );
  const usageReader = new SqliteAccountingDimensionUsageReader(database);

  assert.equal(
    await usageReader.isDimensionTypeInUse("company-1", "type-1"),
    true,
  );
  assert.equal(database.queries.length, 1);
});

test("usage reader detects member parent references", async () => {
  const database = new FakeDatabase(() => [{ found: 1 }]);
  const usageReader = new SqliteAccountingDimensionUsageReader(database);

  assert.equal(await usageReader.isMemberInUse("company-1", "member-1"), true);
  assert.match(database.queries[0]!.sql, /parent_id = \?/);
  assert.deepEqual(database.queries[0]!.parameters, ["company-1", "member-1"]);
});

test("assignment validation loads one company snapshot from SQLite", async () => {
  const database = createValidationDatabase();
  const validationService =
    new SqliteAccountingDimensionAssignmentValidationService(database);

  const issues = await validationService.validate({
    companyId: "company-1",
    accountId: "account-1",
    documentDate: "2026-08-01",
    assignments: [
      {
        dimensionTypeId: "type-1",
        memberIds: ["member-1"],
      },
    ],
  });

  assert.deepEqual(issues, []);
  assert.equal(database.transactionRuns, 1);
  assert.equal(database.queries.length, 3);
  assert.deepEqual(database.queries[0]!.parameters, ["company-1", "account-1"]);
  assert.deepEqual(database.queries[1]!.parameters, ["company-1", "type-1"]);
  assert.deepEqual(database.queries[2]!.parameters, ["member-1"]);
});

test("assignment validation reports unknown types and members", async () => {
  const database = new FakeDatabase(() => []);
  const validationService =
    new SqliteAccountingDimensionAssignmentValidationService(database);

  const issues = await validationService.validate({
    companyId: "company-1",
    accountId: "account-1",
    documentDate: "2026-08-01",
    assignments: [
      {
        dimensionTypeId: "unknown-type",
        memberIds: ["unknown-member"],
      },
    ],
  });

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["policy_not_defined", "dimension_type_not_found", "member_not_found"],
  );
});

test("assertValid exposes domain validation issues", async () => {
  const database = createValidationDatabase();
  const validationService =
    new SqliteAccountingDimensionAssignmentValidationService(database);

  await assert.rejects(
    validationService.assertValid({
      companyId: "company-1",
      accountId: "account-1",
      documentDate: "2026-08-01",
      assignments: [],
    }),
    (error: unknown) => {
      assert.ok(error instanceof AccountingDimensionAssignmentValidationError);
      assert.deepEqual(
        error.issues.map((issue) => issue.code),
        ["required_dimension_missing"],
      );
      return true;
    },
  );
});

function createValidationDatabase(): FakeDatabase {
  return new FakeDatabase((sql) => {
    if (sql.includes("account_dimension_policies")) {
      return [
        {
          id: "policy-1",
          company_id: "company-1",
          account_id: "account-1",
          dimension_type_id: "type-1",
          requirement: "required",
          created_at: now,
          updated_at: now,
          version: 1,
        },
      ];
    }

    if (sql.includes("accounting_dimension_types")) {
      return [
        {
          id: "type-1",
          company_id: "company-1",
          code: "PROJECT",
          name: "پروژه",
          english_name: null,
          hierarchical: 0,
          allow_multiple_members: 0,
          status: "active",
          display_order: 0,
          source: "manual",
          source_reference_id: null,
          created_at: now,
          updated_at: now,
          version: 1,
        },
      ];
    }

    if (sql.includes("accounting_dimension_members")) {
      return [
        {
          id: "member-1",
          company_id: "company-1",
          dimension_type_id: "type-1",
          code: "P-01",
          name: "پروژه یک",
          english_name: null,
          parent_id: null,
          status: "active",
          valid_from: "2026-01-01",
          valid_to: null,
          display_order: 0,
          source: "manual",
          source_reference_id: null,
          created_at: now,
          updated_at: now,
          version: 1,
        },
      ];
    }

    return [];
  });
}
