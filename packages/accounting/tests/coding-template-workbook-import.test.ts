import assert from "node:assert/strict";
import test from "node:test";

import {
  CodingTemplateWorkbookImportError,
  importCodingTemplateWorkbook,
  previewCodingTemplateWorkbookImport,
  type AccountingUnitOfWorkRepositories,
  type CodingTemplateImportHistory,
  type CodingTemplateWorkbookParseResult,
} from "../src/index.ts";
import { IRAN_SERVICE_CODING_CATALOG } from "../src/catalogs/built-in-iranian-coding-catalogs.ts";

const source = Object.freeze({ fileName: "service.xlsx", bytes: new Uint8Array([1, 2, 3]) });
const hash = "a".repeat(64);
const metadata = Object.freeze({ contractVersion: "1.0" as const, templateCode: "excel-service", persianName: "الگوی خدماتی اکسل", englishName: "Excel service", activityType: "service" as const });

function fixture(options: { invalid?: boolean; failVersion?: boolean; permission?: boolean } = {}) {
  const imports: CodingTemplateImportHistory[] = [];
  const templates: unknown[] = [];
  const versions: unknown[] = [];
  let sequence = 0;
  const parser = {
    async parse(): Promise<CodingTemplateWorkbookParseResult> {
      if (options.invalid) return { success: false, metadata: null, content: null, issues: [{ code: "cell_required", message: "required", location: { sheet: "Accounts", row: 2, column: "code", address: "D2" } }] };
      return { success: true, metadata, content: IRAN_SERVICE_CODING_CATALOG.content, issues: [] };
    },
  };
  const repositories = {
    accounts: {}, codingSettings: {},
    codingTemplates: {
      create: async (value: unknown) => { templates.push(value); },
      findByCode: async (code: string) => (templates as Array<{ code: string }>).find((item) => String(item.code) === code) ?? null,
    },
    codingTemplateVersions: { create: async (value: unknown) => { if (options.failVersion) throw new Error("version write failed"); versions.push(value); } },
    codingTemplateImports: {
      create: async (value: CodingTemplateImportHistory) => { imports.push(value); },
      findByImportKey: async (key: string) => imports.find((item) => item.importKey === key) ?? null,
    },
  } as unknown as AccountingUnitOfWorkRepositories;
  const state = () => [templates.length, versions.length, imports.length] as const;
  const unitOfWork = {
    async run<T>(operation: (repositories: AccountingUnitOfWorkRepositories) => Promise<T>): Promise<T> {
      const before = state();
      try { return await operation(repositories); }
      catch (error) { templates.length = before[0]; versions.length = before[1]; imports.length = before[2]; throw error; }
    },
  };
  const dependencies = {
    parser,
    fingerprintProvider: { sha256: async () => hash },
    unitOfWork,
    authorizer: { hasPermission: async () => options.permission ?? true },
    clock: { now: () => new Date("2026-08-03T14:00:00.000Z") },
    idGenerator: { generate: () => `id-${++sequence}` },
  };
  const command = { source, importKey: "batch-1", expectedFileFingerprint: hash, confirmed: true, actorId: "admin" } as const;
  return { imports, templates, versions, parser, dependencies, command, state };
}

test("previews a valid workbook without writing and returns a complete dry-run summary", async () => {
  const f = fixture();
  const preview = await previewCodingTemplateWorkbookImport(source, f.dependencies);
  assert.equal(preview.canImport, true);
  assert.equal(preview.fileFingerprint, hash);
  assert.equal(preview.summary.accountCount, IRAN_SERVICE_CODING_CATALOG.content.accounts.length);
  assert.equal(preview.summary.totalItemCount, preview.summary.accountCount + preview.summary.dimensionTypeCount + preview.summary.dimensionMemberCount + preview.summary.accountDimensionPolicyCount);
  assert.deepEqual(f.state(), [0, 0, 0]);
});

test("returns parser cell errors and writes nothing for an invalid workbook", async () => {
  const f = fixture({ invalid: true });
  const preview = await previewCodingTemplateWorkbookImport(source, f.dependencies);
  assert.equal(preview.canImport, false);
  assert.equal(preview.issues[0]?.source, "workbook");
  await assert.rejects(() => importCodingTemplateWorkbook(f.command, f.dependencies), (error: unknown) => error instanceof CodingTemplateWorkbookImportError && error.code === "preview_invalid");
  assert.deepEqual(f.state(), [0, 0, 0]);
});

test("maps cross-sheet graph errors back to the originating row and cell field", async () => {
  const f = fixture();
  const invalid = { ...IRAN_SERVICE_CODING_CATALOG.content, accountDimensionPolicies: IRAN_SERVICE_CODING_CATALOG.content.accountDimensionPolicies.map((item, index) => index === 0 ? { ...item, dimensionTypeLogicalKey: "missing" } : item) };
  f.parser.parse = async () => ({ success: true, metadata, content: invalid, issues: [] });
  const preview = await previewCodingTemplateWorkbookImport(source, f.dependencies);
  const issue = preview.issues.find((value) => value.source === "graph");
  assert.equal(preview.canImport, false);
  assert.equal(issue?.source === "graph" ? issue.location?.sheet : null, "AccountDimensionPolicies");
  assert.equal(issue?.source === "graph" ? issue.location?.column : null, "dimensionTypeLogicalKey");
  assert.equal(issue?.source === "graph" ? issue.location?.address : null, "B2");
});

test("imports template, version, provenance, and batch history in one transaction", async () => {
  const f = fixture();
  const result = await importCodingTemplateWorkbook(f.command, f.dependencies);
  assert.equal(result.idempotentReplay, false);
  assert.deepEqual(f.state(), [1, 1, 1]);
  assert.equal(f.imports[0]?.fileFingerprint, hash);
  assert.equal(f.imports[0]?.contractVersion, "1.0");
  assert.equal(f.imports[0]?.actorId, "admin");
  assert.equal(f.imports[0]?.status, "published");
});

test("returns the prior batch on a retry and prevents duplicates", async () => {
  const f = fixture();
  const first = await importCodingTemplateWorkbook(f.command, f.dependencies);
  const state = f.state();
  const replay = await importCodingTemplateWorkbook(f.command, f.dependencies);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.importHistory.id, first.importHistory.id);
  assert.deepEqual(f.state(), state);
});

test("rejects unconfirmed, stale, unauthorized, and reused import identities before writes", async () => {
  const f = fixture();
  await assert.rejects(() => importCodingTemplateWorkbook({ ...f.command, confirmed: false }, f.dependencies), (error: unknown) => error instanceof CodingTemplateWorkbookImportError && error.code === "confirmation_required");
  await assert.rejects(() => importCodingTemplateWorkbook({ ...f.command, expectedFileFingerprint: "b".repeat(64) }, f.dependencies), (error: unknown) => error instanceof CodingTemplateWorkbookImportError && error.code === "stale_preview");
  const denied = fixture({ permission: false });
  await assert.rejects(() => importCodingTemplateWorkbook(denied.command, denied.dependencies), (error: unknown) => error instanceof CodingTemplateWorkbookImportError && error.code === "permission_denied");
  await importCodingTemplateWorkbook(f.command, f.dependencies);
  f.dependencies.fingerprintProvider.sha256 = async () => "c".repeat(64);
  await assert.rejects(() => importCodingTemplateWorkbook({ ...f.command, expectedFileFingerprint: "c".repeat(64) }, f.dependencies), (error: unknown) => error instanceof CodingTemplateWorkbookImportError && error.code === "import_key_reused");
});

test("rolls back all records when any import write fails", async () => {
  const f = fixture({ failVersion: true });
  await assert.rejects(() => importCodingTemplateWorkbook(f.command, f.dependencies), /version write failed/);
  assert.deepEqual(f.state(), [0, 0, 0]);
});
