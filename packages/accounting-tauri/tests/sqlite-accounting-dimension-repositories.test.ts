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

test("dimension repositories map complete rows and scoped lookup queries", async () => {
  const database = new FakeDatabase();
  database.queryOneRows = [
    {
      id: "member-1",
      company_id: "company-1",
      dimension_type_id: "type-1",
      code: "P-01",
      name: "پروژه یک",
      english_name: "Project one",
      parent_id: "member-parent",
      status: "inactive",
      valid_from: "2026-01-01",
      valid_to: "2026-12-31",
      display_order: 4,
      source: "module",
      source_reference_id: "projects",
      created_at: now,
      updated_at: now,
      version: 3,
    },
    {
      id: "policy-1",
      company_id: "company-1",
      account_id: "account-1",
      dimension_type_id: "type-1",
      requirement: "forbidden",
      created_at: now,
      updated_at: now,
      version: 2,
    },
  ];

  const member = await new SqliteAccountingDimensionMemberRepository(
    database,
  ).findByCode("company-1", "type-1", "p-01");
  const policy = await new SqliteAccountDimensionPolicyRepository(
    database,
  ).findByAccountAndType("company-1", "account-1", "type-1");

  assert.deepEqual(member, {
    id: "member-1",
    companyId: "company-1",
    dimensionTypeId: "type-1",
    code: "P-01",
    name: "پروژه یک",
    englishName: "Project one",
    parentId: "member-parent",
    status: "inactive",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    displayOrder: 4,
    source: "module",
    sourceReferenceId: "projects",
    createdAt: now,
    updatedAt: now,
    version: 3,
  });
  assert.equal(policy?.requirement, "forbidden");
  assert.deepEqual(database.queries[0]!.parameters, [
    "company-1",
    "type-1",
    "p-01",
  ]);
  assert.deepEqual(database.queries[1]!.parameters, [
    "company-1",
    "account-1",
    "type-1",
  ]);
});

test("member search escapes LIKE tokens and supports root members", async () => {
  const database = new FakeDatabase();
  database.queryOneRows = [{ total: 0 }];

  await new SqliteAccountingDimensionMemberRepository(database).search({
    companyId: "company-1",
    parentId: null,
    text: "50%_\\",
  });

  assert.match(database.queries[0]!.sql, /parent_id IS NULL/u);
  assert.match(database.queries[0]!.sql, /LIKE \? ESCAPE '\\'/u);
  assert.deepEqual(database.queries[0]!.parameters.slice(-3), [
    "%50\\%\\_\\\\%",
    "%50\\%\\_\\\\%",
    "%50\\%\\_\\\\%",
  ]);
});

test("updates and deletes remain company scoped and version guarded", async () => {
  const database = new FakeDatabase();
  const dimensionType = { ...createDimensionType(), version: 2 };
  const policy = {
    ...createDimensionPolicy(),
    requirement: "optional" as const,
    version: 2,
  };

  await new SqliteAccountingDimensionTypeRepository(database).update(
    dimensionType,
  );
  await new SqliteAccountDimensionPolicyRepository(database).update(policy);
  await new SqliteAccountingDimensionTypeRepository(database).delete(
    dimensionType,
  );
  await new SqliteAccountDimensionPolicyRepository(database).delete(policy);

  assert.deepEqual(database.executions[0]!.parameters.slice(-3), [
    "type-1",
    "company-1",
    1,
  ]);
  assert.deepEqual(database.executions[1]!.parameters.slice(-3), [
    "policy-1",
    "company-1",
    1,
  ]);
  assert.deepEqual(database.executions[2]!.parameters, [
    "type-1",
    "company-1",
    2,
  ]);
  assert.deepEqual(database.executions[3]!.parameters, [
    "policy-1",
    "company-1",
    2,
  ]);
});

test("all aggregate deletes report optimistic concurrency conflicts", async () => {
  const database = new FakeDatabase();
  database.rowsAffected = 0;

  await assert.rejects(
    new SqliteAccountingDimensionTypeRepository(database).delete(
      createDimensionType(),
    ),
    { name: "ConcurrencyConflictError" },
  );
  await assert.rejects(
    new SqliteAccountingDimensionMemberRepository(database).delete(
      createDimensionMember(),
    ),
    { name: "ConcurrencyConflictError" },
  );
  await assert.rejects(
    new SqliteAccountDimensionPolicyRepository(database).delete(
      createDimensionPolicy(),
    ),
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
