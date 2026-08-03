import assert from "node:assert/strict";
import test from "node:test";
import {
  createCodingTemplate,
  publishCodingTemplate,
  type CodingTemplateApplicationHistory,
  type CodingTemplateImportHistory,
} from "@argin/accounting";
import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  BuiltInCodingTemplateCatalogProvider,
  SqliteAccountingUnitOfWork,
  SqliteCodingTemplateApplicationHistoryRepository,
  SqliteCodingTemplateApplicationItemMappingRepository,
  SqliteCodingTemplateImportHistoryRepository,
  SqliteCodingTemplateRepository,
  SqliteCodingTemplateVersionRepository,
} from "../src/index.ts";

class FakeDatabase implements DatabaseExecutor {
  readonly executions: { sql: string; parameters: readonly DatabaseValue[] }[] = [];
  readonly queries: { sql: string; parameters: readonly DatabaseValue[] }[] = [];
  queryRows: unknown[] = [];
  queryOneRows: unknown[] = [];
  rowsAffected = 1;
  transactionRuns = 0;

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

  async transaction<T>(
    operation: (session: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    this.transactionRuns++;
    return operation(this);
  }

  async close(): Promise<void> {}
}

const now = "2026-08-03T10:00:00.000Z";

const draft = () =>
  createCodingTemplate({
    id: "template-1",
    code: "SERVICE",
    persianName: "خدماتی",
    activityType: "service",
    ownership: "custom",
    createdAt: now,
  });

const published = () =>
  publishCodingTemplate(draft(), {
    id: "version-1",
    source: {
      type: "excel",
      reference: "service.xlsx",
      contractVersion: "1.0",
      contentFingerprint: "a".repeat(64),
    },
    publishedAt: now,
    publishedBy: "admin",
  });

const app: CodingTemplateApplicationHistory = {
  id: "application-1",
  companyId: "company-1",
  templateId: "template-1",
  templateVersionId: "version-1",
  requestKey: "request-1",
  status: "applied",
  baselineFingerprint: "b".repeat(64),
  appliedAt: now,
  actorId: "admin",
  createdAt: now,
};

const imported: CodingTemplateImportHistory = {
  id: "import-1",
  importKey: "key-1",
  fileName: "service.xlsx",
  fileFingerprint: "a".repeat(64),
  contractVersion: "1.0",
  status: "published",
  templateId: "template-1",
  templateVersionId: "version-1",
  actorId: "admin",
  createdAt: now,
  completedAt: now,
};

test("template repository persists and maps optimistic aggregates", async () => {
  const db = new FakeDatabase();
  const repo = new SqliteCodingTemplateRepository(db);

  await repo.create(draft());
  assert.match(db.executions[0]!.sql, /INSERT INTO coding_templates/);

  db.queryOneRows = [
    {
      id: "template-1",
      code: "SERVICE",
      persian_name: "خدماتی",
      english_name: null,
      activity_type: "service",
      ownership: "custom",
      lifecycle: "draft",
      latest_published_version: null,
      created_at: now,
      updated_at: now,
      version: 1,
    },
  ];
  assert.equal((await repo.findByCode("service"))?.optimisticVersion, 1);

  db.rowsAffected = 0;
  await assert.rejects(repo.update({ ...draft(), optimisticVersion: 2 }), {
    name: "ConcurrencyConflictError",
  });
});

test("version repository writes normalized content in dependency order", async () => {
  const db = new FakeDatabase();
  const value = published();

  const accountData = {
    logicalKey: "assets",
    parentLogicalKey: null,
    level: "group" as const,
    code: "1",
    persianName: "دارایی",
    englishName: null,
    nature: "debit" as const,
    normalBalance: "debit" as const,
    statementType: "balance_sheet" as const,
    reportClassification: {
      balanceSheetSection: "assets" as const,
      incomeStatementSection: null,
      cashFlowCategory: null,
      cashEquivalent: false,
      receivable: false,
      payable: false,
      managementTags: [],
    },
    postingAllowed: false,
    currencyEnabled: false,
    revaluationEnabled: false,
    trackingEnabled: false,
    dueDateEnabled: false,
    activeByDefault: true,
    displayOrder: 1,
  };

  await new SqliteCodingTemplateVersionRepository(db).create({
    version: value.version,
    content: {
      accounts: [accountData],
      dimensionTypes: [],
      dimensionMembers: [],
      accountDimensionPolicies: [],
    },
  });

  assert.match(db.executions[0]!.sql, /coding_template_versions/);
  assert.match(db.executions[1]!.sql, /coding_template_accounts/);
  assert.equal(
    db.executions[1]!.parameters[10],
    JSON.stringify(accountData.reportClassification),
  );
});

test("application and mapping repositories preserve idempotency keys and provenance", async () => {
  const db = new FakeDatabase();

  await new SqliteCodingTemplateApplicationHistoryRepository(db).create(app);

  const mapping = {
    applicationId: app.id,
    companyId: app.companyId,
    templateVersionId: app.templateVersionId,
    itemType: "account" as const,
    logicalKey: "assets",
    operationalId: "account-1",
    action: "created" as const,
  };
  await new SqliteCodingTemplateApplicationItemMappingRepository(db).createMany([
    mapping,
  ]);

  assert.deepEqual(db.executions[0]!.parameters.slice(0, 6), [
    "application-1",
    "company-1",
    "template-1",
    "version-1",
    "request-1",
    "applied",
  ]);
  assert.match(db.executions[1]!.sql, /coding_template_application_items/);
});

test("import repository persists complete file provenance", async () => {
  const db = new FakeDatabase();
  await new SqliteCodingTemplateImportHistoryRepository(db).create(imported);

  assert.deepEqual(db.executions[0]!.parameters, [
    "import-1",
    "key-1",
    "service.xlsx",
    "a".repeat(64),
    "1.0",
    "published",
    "template-1",
    "version-1",
    "admin",
    now,
    now,
  ]);
});

test("search normalizes stable ordering, filters and paging", async () => {
  const db = new FakeDatabase();
  db.queryOneRows = [{ total: 3 }];

  const page = await new SqliteCodingTemplateRepository(db).search({
    text: "خدمات",
    activityType: "service",
    pagination: { page: 2, pageSize: 2 },
    sorts: [{ field: "updatedAt", direction: "descending" }],
  });

  assert.equal(page.totalPages, 2);
  assert.match(
    db.queries[1]!.sql,
    /ORDER BY updated_at DESC, id ASC LIMIT \? OFFSET \?/,
  );
  assert.deepEqual(db.queries[1]!.parameters.slice(-2), [2, 2]);
});

test("unit of work exposes all coding adapters through one transaction session", async () => {
  const db = new FakeDatabase();

  await new SqliteAccountingUnitOfWork(db).run(async (r) => {
    assert.ok(r.codingTemplates);
    assert.ok(r.codingTemplateVersions);
    assert.ok(r.codingTemplateApplications);
    assert.ok(r.codingTemplateApplicationMappings);
    assert.ok(r.codingTemplateBaselines);
    assert.ok(r.codingTemplateImports);
  });

  assert.equal(db.transactionRuns, 1);
});

test("unit of work propagates failures so the executor can roll back atomically", async () => {
  const db = new FakeDatabase();

  await assert.rejects(
    new SqliteAccountingUnitOfWork(db).run(async () => {
      throw new Error("write failed");
    }),
    /write failed/,
  );

  assert.equal(db.transactionRuns, 1);
});

test("built-in catalog adapter recommends by activity without auto-applying", async () => {
  const provider = new BuiltInCodingTemplateCatalogProvider();

  assert.equal(
    (await provider.findByCode(" IRAN-SERVICE-DEFAULT "))?.activityType,
    "service",
  );

  assert.deepEqual(
    (await provider.recommendForActivityType("trading")).map(
      (x) => x.templateCode,
    ),
    ["iran-trading-default"],
  );

  assert.deepEqual(await provider.recommendForActivityType("custom"), []);
  assert.equal((await provider.listPublished()).length, 3);
});
