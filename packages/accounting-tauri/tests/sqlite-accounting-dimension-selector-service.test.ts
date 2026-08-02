import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatabaseExecutor,
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import { SqliteAccountingDimensionSelectorService } from "../src/index.ts";

interface DatabaseCall {
  readonly sql: string;
  readonly parameters: readonly DatabaseValue[];
}

class FakeDatabase implements DatabaseExecutor, DatabaseSession {
  readonly queries: DatabaseCall[] = [];
  transactionRuns = 0;

  constructor(
    private readonly queryHandler: (
      sql: string,
      parameters: readonly DatabaseValue[],
    ) => readonly unknown[],
  ) {}

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

  async queryOne<T>(): Promise<T | null> {
    return null;
  }

  async transaction<T>(
    operation: (session: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    this.transactionRuns += 1;
    return operation(this);
  }

  async close(): Promise<void> {}
}

test("builds dynamic fields from policies and effective members", async () => {
  const database = createSelectorDatabase();
  const service = new SqliteAccountingDimensionSelectorService(database);

  const model = await service.load({
    companyId: " company-1 ",
    accountId: " account-1 ",
    documentDate: "2026-08-02",
    assignments: [
      {
        dimensionTypeId: "type-project",
        memberIds: ["project-active", "unknown-member"],
      },
    ],
  });

  assert.equal(database.transactionRuns, 1);
  assert.equal(model.companyId, "company-1");
  assert.deepEqual(
    model.fields.map((field) => [field.code, field.requirement]),
    [
      ["PROJECT", "required"],
      ["COST_CENTER", "optional"],
      ["CONTRACT", "forbidden"],
    ],
  );
  assert.deepEqual(model.fields[0]?.selectedMemberIds, ["project-active"]);
  assert.equal(model.fields[0]?.required, true);
  assert.equal(model.fields[1]?.multiple, true);
  assert.equal(model.fields[2]?.disabled, true);
  assert.deepEqual(model.fields[2]?.options, []);
  assert.deepEqual(database.queries[0]?.parameters, ["company-1", "account-1"]);
  assert.deepEqual(database.queries[1]?.parameters, [
    "company-1",
    "type-project",
    "type-cost",
    "2026-08-02",
    "2026-08-02",
  ]);
});

test("returns an empty model without querying members when no policy exists", async () => {
  const database = new FakeDatabase(() => []);
  const service = new SqliteAccountingDimensionSelectorService(database);

  const model = await service.load({
    companyId: "company-1",
    accountId: "account-1",
    documentDate: "2026-08-02",
  });

  assert.deepEqual(model.fields, []);
  assert.equal(database.queries.length, 1);
});

test("rejects invalid future-consumer requests before opening a transaction", async () => {
  const database = new FakeDatabase(() => []);
  const service = new SqliteAccountingDimensionSelectorService(database);

  await assert.rejects(
    service.load({
      companyId: " ",
      accountId: "account-1",
      documentDate: "2026-08-02",
    }),
    /companyId is required/u,
  );
  await assert.rejects(
    service.load({
      companyId: "company-1",
      accountId: "account-1",
      documentDate: "2026-02-30",
    }),
    /documentDate must use YYYY-MM-DD/u,
  );
  assert.equal(database.transactionRuns, 0);
});

function createSelectorDatabase(): FakeDatabase {
  return new FakeDatabase((sql) => {
    if (sql.includes("account_dimension_policies")) {
      return [
        selectorPolicy("type-project", "required", "PROJECT", "پروژه", 0),
        selectorPolicy("type-cost", "optional", "COST_CENTER", "مرکز هزینه", 1),
        selectorPolicy("type-contract", "forbidden", "CONTRACT", "قرارداد", 0),
      ];
    }
    if (sql.includes("accounting_dimension_members")) {
      return [
        selectorMember("project-active", "type-project", "P-01", "پروژه یک"),
        selectorMember("cost-active", "type-cost", "C-01", "مرکز هزینه یک"),
      ];
    }
    return [];
  });
}

function selectorPolicy(
  dimensionTypeId: string,
  requirement: string,
  code: string,
  name: string,
  multiple: number,
) {
  return {
    dimension_type_id: dimensionTypeId,
    requirement,
    code,
    name,
    hierarchical: 0,
    allow_multiple_members: multiple,
  };
}

function selectorMember(
  id: string,
  dimensionTypeId: string,
  code: string,
  name: string,
) {
  return {
    id,
    dimension_type_id: dimensionTypeId,
    code,
    name,
    parent_id: null,
    display_order: 0,
  };
}
