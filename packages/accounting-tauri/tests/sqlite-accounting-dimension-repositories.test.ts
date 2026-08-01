import assert from "node:assert/strict";
import test from "node:test";
import {
  createAccountDimensionPolicy,
  createAccountingDimensionMember,
  createAccountingDimensionType,
} from "@argin/accounting";
import type {
  DatabaseExecutor,
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import {
  SqliteAccountDimensionPolicyRepository,
  SqliteAccountingDimensionMemberRepository,
  SqliteAccountingDimensionTypeRepository,
  SqliteAccountingUnitOfWork,
} from "../src/index.ts";

interface DatabaseCall {
  sql: string;
  parameters: readonly DatabaseValue[];
}

class FakeDatabase implements DatabaseSession {
  readonly executions: DatabaseCall[] = [];
  readonly queries: DatabaseCall[] = [];

  rowsAffected = 1;
  queryRows: unknown[] = [];
  queryOneRows: unknown[] = [];

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
    return this.queryRows as T[];
  }

  async queryOne<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T | null> {
    this.queries.push({ sql, parameters });
    return (this.queryOneRows.shift() ?? null) as T | null;
  }
}

class FakeExecutor extends FakeDatabase implements DatabaseExecutor {
  transactionRuns = 0;

  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>) {
    this.transactionRuns++;
    return operation(this);
  }

  async close() {}
}

const now = "2026-08-01T00:00:00.000Z";

const createDimensionType = () =>
  createAccountingDimensionType({
    id: "type-1",
    companyId: "company-1",
    code: "PROJECT",
    name: "پروژه",
    hierarchical: true,
    createdAt: now,
  });

const createDimensionMember = () =>
  createAccountingDimensionMember({
    id: "member-1",
    companyId: "company-1",
    dimensionTypeId: "type-1",
    code: "P-01",
    name: "پروژه یک",
    validFrom: "2026-01-01",
    createdAt: now,
  });

const createDimensionPolicy = () =>
  createAccountDimensionPolicy({
    id: "policy-1",
    companyId: "company-1",
    accountId: "account-1",
    dimensionTypeId: "type-1",
    requirement: "required",
    createdAt: now,
  });

test("dimension repositories persist every aggregate", async () => {
  const database = new FakeDatabase();

  await new SqliteAccountingDimensionTypeRepository(database).create(
    createDimensionType(),
  );
  await new SqliteAccountingDimensionMemberRepository(database).create(
    createDimensionMember(),
  );
  await new SqliteAccountDimensionPolicyRepository(database).create(
    createDimensionPolicy(),
  );

  assert.match(
    database.executions[0]!.sql,
    /INSERT INTO accounting_dimension_types/,
  );
  assert.match(
    database.executions[1]!.sql,
    /INSERT INTO accounting_dimension_members/,
  );
  assert.match(
    database.executions[2]!.sql,
    /INSERT INTO account_dimension_policies/,
  );
});

test("dimension type maps SQLite booleans", async () => {
  const database = new FakeDatabase();
  database.queryOneRows = [
    {
      id: "type-1",
      company_id: "company-1",
      code: "PROJECT",
      name: "پروژه",
      english_name: null,
      hierarchical: 1,
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

  const dimensionType =
    await new SqliteAccountingDimensionTypeRepository(database).findById(
      "type-1",
    );

  assert.equal(dimensionType?.hierarchical, true);
  assert.equal(dimensionType?.allowMultipleMembers, false);
});

test("member search applies company, type, status, validity, stable order and paging", async () => {
  const database = new FakeDatabase();
  database.queryOneRows = [{ total: 2 }];

  await new SqliteAccountingDimensionMemberRepository(database).search({
    companyId: "company-1",
    dimensionTypeId: "type-1",
    status: "active",
    effectiveOn: "2026-08-01",
    pagination: { page: 2, pageSize: 1 },
    sorts: [{ field: "code", direction: "descending" }],
  });

  assert.match(
    database.queries[0]!.sql,
    /COUNT\(\*\).*company_id = \?.*dimension_type_id = \?.*valid_from IS NULL/s,
  );
  assert.match(
    database.queries[1]!.sql,
    /ORDER BY code DESC, id ASC LIMIT \? OFFSET \?/,
  );
  assert.deepEqual(database.queries[1]!.parameters, [
    "company-1",
    "type-1",
    "active",
    "2026-08-01",
    "2026-08-01",
    1,
    1,
  ]);
});

test("policy search returns complete paging metadata", async () => {
  const database = new FakeDatabase();
  database.queryOneRows = [{ total: 3 }];

  const result = await new SqliteAccountDimensionPolicyRepository(database).search({
    companyId: "company-1",
    accountId: "account-1",
    pagination: { page: 1, pageSize: 2 },
  });

  assert.equal(result.totalPages, 2);
  assert.equal(result.hasNextPage, true);
  assert.equal(result.totalItems, 3);
});

test("dimension update enforces optimistic concurrency", async () => {
  const database = new FakeDatabase();
  database.rowsAffected = 0;

  await assert.rejects(
    new SqliteAccountingDimensionMemberRepository(database).update({
      ...createDimensionMember(),
      version: 2,
    }),
    { name: "ConcurrencyConflictError" },
  );
});

test("unit of work exposes all dimension repositories in one transaction", async () => {
  const database = new FakeExecutor();

  await new SqliteAccountingUnitOfWork(database).run(async (repositories) => {
    assert.ok(repositories.dimensionTypes);
    assert.ok(repositories.dimensionMembers);
    assert.ok(repositories.dimensionPolicies);

    await repositories.dimensionTypes.create(createDimensionType());
    await repositories.dimensionMembers.create(createDimensionMember());
    await repositories.dimensionPolicies.create(createDimensionPolicy());
  });

  assert.equal(database.transactionRuns, 1);
  assert.equal(database.executions.length, 3);
});
