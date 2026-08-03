import type { AccountingUnitOfWork, AccountingUnitOfWorkRepositories } from "../contracts/accounting-unit-of-work.ts";
import type { CodingTemplateImportHistory } from "../contracts/coding-template-records.ts";
import type { CodingTemplateAuthorizer, CodingTemplateClock, CodingTemplateIdentifierGenerator } from "../contracts/coding-template-runtime.ts";
import type {
  CodingTemplateWorkbookCellLocation,
  CodingTemplateWorkbookIssue,
  CodingTemplateWorkbookMetadata,
  CodingTemplateWorkbookParser,
  CodingTemplateWorkbookSource,
} from "../contracts/coding-template-workbook.ts";
import { CODING_TEMPLATE_WORKBOOK_SHEETS } from "../contracts/coding-template-workbook.ts";
import { createCodingTemplate, publishCodingTemplate } from "../domain/coding-template.ts";
import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";
import type { CodingTemplateGraphValidationIssue } from "../validation/coding-template-graph-validation-error.ts";
import { validateCodingTemplateGraph } from "../validation/validate-coding-template-graph.ts";

export const IMPORT_CODING_TEMPLATE_WORKBOOK_PERMISSION = "accounting.coding-template.import";

export type CodingTemplateWorkbookPreviewIssue =
  | { readonly source: "workbook"; readonly issue: Readonly<CodingTemplateWorkbookIssue> }
  | { readonly source: "graph"; readonly issue: Readonly<CodingTemplateGraphValidationIssue>; readonly location: Readonly<CodingTemplateWorkbookCellLocation> | null };

export interface CodingTemplateWorkbookPreviewSummary {
  readonly accountCount: number;
  readonly dimensionTypeCount: number;
  readonly dimensionMemberCount: number;
  readonly accountDimensionPolicyCount: number;
  readonly totalItemCount: number;
  readonly errorCount: number;
}

export interface CodingTemplateWorkbookImportPreview {
  readonly fileName: string;
  readonly fileFingerprint: string;
  readonly metadata: Readonly<CodingTemplateWorkbookMetadata> | null;
  readonly content: Readonly<CodingTemplateVersionContent> | null;
  readonly canImport: boolean;
  readonly issues: readonly Readonly<CodingTemplateWorkbookPreviewIssue>[];
  readonly summary: Readonly<CodingTemplateWorkbookPreviewSummary>;
}

export interface CodingTemplateWorkbookFingerprintProvider {
  sha256(bytes: Uint8Array): Promise<string>;
}

export interface PreviewCodingTemplateWorkbookImportDependencies {
  readonly parser: CodingTemplateWorkbookParser;
  readonly fingerprintProvider: CodingTemplateWorkbookFingerprintProvider;
}

export interface ImportCodingTemplateWorkbookCommand {
  readonly source: Readonly<CodingTemplateWorkbookSource>;
  readonly importKey: string;
  readonly expectedFileFingerprint: string;
  readonly confirmed: boolean;
  readonly actorId: string;
}

export interface ImportCodingTemplateWorkbookResult {
  readonly importHistory: Readonly<CodingTemplateImportHistory>;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly idempotentReplay: boolean;
}

export interface ImportCodingTemplateWorkbookDependencies extends PreviewCodingTemplateWorkbookImportDependencies {
  readonly unitOfWork: AccountingUnitOfWork;
  readonly authorizer: CodingTemplateAuthorizer;
  readonly clock: CodingTemplateClock;
  readonly idGenerator: CodingTemplateIdentifierGenerator;
}

export type CodingTemplateWorkbookImportErrorCode =
  | "confirmation_required"
  | "invalid_identifier"
  | "permission_denied"
  | "preview_invalid"
  | "stale_preview"
  | "import_key_reused"
  | "template_code_exists"
  | "repository_unavailable";

export class CodingTemplateWorkbookImportError extends Error {
  constructor(readonly code: CodingTemplateWorkbookImportErrorCode, readonly field: string | null) {
    super(code);
    this.name = "CodingTemplateWorkbookImportError";
  }
}

export async function previewCodingTemplateWorkbookImport(
  source: Readonly<CodingTemplateWorkbookSource>,
  dependencies: PreviewCodingTemplateWorkbookImportDependencies,
): Promise<CodingTemplateWorkbookImportPreview> {
  const fileFingerprint = normalizeFingerprint(await dependencies.fingerprintProvider.sha256(source.bytes));
  const parsed = await dependencies.parser.parse(source);
  if (!parsed.success) {
    const issues = parsed.issues.map((issue) => Object.freeze({ source: "workbook" as const, issue }));
    return result(source.fileName, fileFingerprint, null, null, issues);
  }

  const graphIssues = validateCodingTemplateGraph(parsed.content);
  const issues = graphIssues.map((issue) => Object.freeze({
    source: "graph" as const,
    issue,
    location: locateGraphIssue(parsed.content, issue),
  }));
  return result(source.fileName, fileFingerprint, parsed.metadata, parsed.content, issues);
}

export async function importCodingTemplateWorkbook(
  command: ImportCodingTemplateWorkbookCommand,
  dependencies: ImportCodingTemplateWorkbookDependencies,
): Promise<ImportCodingTemplateWorkbookResult> {
  const importKey = required(command.importKey, "importKey");
  const actorId = required(command.actorId, "actorId");
  const expected = normalizeFingerprint(command.expectedFileFingerprint);
  if (!command.confirmed) throw new CodingTemplateWorkbookImportError("confirmation_required", "confirmed");
  if (!await dependencies.authorizer.hasPermission(IMPORT_CODING_TEMPLATE_WORKBOOK_PERMISSION)) {
    throw new CodingTemplateWorkbookImportError("permission_denied", null);
  }
  const preview = await previewCodingTemplateWorkbookImport(command.source, dependencies);
  if (preview.fileFingerprint !== expected) throw new CodingTemplateWorkbookImportError("stale_preview", "expectedFileFingerprint");
  if (!preview.canImport || !preview.metadata || !preview.content) throw new CodingTemplateWorkbookImportError("preview_invalid", null);
  const metadata = preview.metadata;
  const content = preview.content;

  return dependencies.unitOfWork.run(async (all) => {
    const repositories = importRepositories(all);
    const previous = await repositories.imports.findByImportKey(importKey);
    if (previous) {
      if (previous.fileFingerprint !== preview.fileFingerprint || previous.status !== "published" || !previous.templateId || !previous.templateVersionId) {
        throw new CodingTemplateWorkbookImportError("import_key_reused", "importKey");
      }
      return { importHistory: previous, templateId: previous.templateId, templateVersionId: previous.templateVersionId, idempotentReplay: true };
    }
    if (await repositories.templates.findByCode(metadata.templateCode)) {
      throw new CodingTemplateWorkbookImportError("template_code_exists", "templateCode");
    }

    const now = dependencies.clock.now().toISOString();
    const draft = createCodingTemplate({
      id: dependencies.idGenerator.generate(),
      code: metadata.templateCode,
      persianName: metadata.persianName,
      englishName: metadata.englishName,
      activityType: metadata.activityType,
      ownership: "custom",
      createdAt: now,
    });
    const published = publishCodingTemplate(draft, {
      id: dependencies.idGenerator.generate(),
      source: { type: "excel", reference: command.source.fileName, contractVersion: metadata.contractVersion, contentFingerprint: preview.fileFingerprint },
      publishedAt: now,
      publishedBy: actorId,
    });
    const history: CodingTemplateImportHistory = Object.freeze({
      id: dependencies.idGenerator.generate(),
      importKey,
      fileName: command.source.fileName,
      fileFingerprint: preview.fileFingerprint,
      contractVersion: metadata.contractVersion,
      status: "published",
      templateId: String(published.template.id),
      templateVersionId: String(published.version.id),
      actorId,
      createdAt: now,
      completedAt: now,
    });
    await repositories.templates.create(published.template);
    await repositories.versions.create({ version: published.version, content });
    await repositories.imports.create(history);
    return { importHistory: history, templateId: history.templateId!, templateVersionId: history.templateVersionId!, idempotentReplay: false };
  });
}

function result(fileName: string, fileFingerprint: string, metadata: CodingTemplateWorkbookMetadata | null, content: CodingTemplateVersionContent | null, issues: readonly CodingTemplateWorkbookPreviewIssue[]): CodingTemplateWorkbookImportPreview {
  const summary = Object.freeze({
    accountCount: content?.accounts.length ?? 0,
    dimensionTypeCount: content?.dimensionTypes.length ?? 0,
    dimensionMemberCount: content?.dimensionMembers.length ?? 0,
    accountDimensionPolicyCount: content?.accountDimensionPolicies.length ?? 0,
    totalItemCount: content ? content.accounts.length + content.dimensionTypes.length + content.dimensionMembers.length + content.accountDimensionPolicies.length : 0,
    errorCount: issues.length,
  });
  return Object.freeze({ fileName, fileFingerprint, metadata, content, canImport: issues.length === 0 && metadata !== null && content !== null, issues: Object.freeze([...issues]), summary });
}

function locateGraphIssue(content: CodingTemplateVersionContent, issue: CodingTemplateGraphValidationIssue): CodingTemplateWorkbookCellLocation | null {
  let sheet: CodingTemplateWorkbookCellLocation["sheet"];
  let index: number;
  if (issue.itemType === "account") {
    sheet = "Accounts"; index = content.accounts.findIndex((item) => item.logicalKey === issue.logicalKey);
  } else if (issue.itemType === "dimension_type") {
    sheet = "DimensionTypes"; index = content.dimensionTypes.findIndex((item) => item.logicalKey === issue.logicalKey);
  } else if (issue.itemType === "dimension_member") {
    sheet = "DimensionMembers"; index = content.dimensionMembers.findIndex((item) => item.logicalKey === issue.logicalKey);
  } else {
    sheet = "AccountDimensionPolicies"; index = content.accountDimensionPolicies.findIndex((item) => item.accountLogicalKey === issue.logicalKey);
  }
  if (index < 0) return null;
  const row = index + 2;
  const definition = CODING_TEMPLATE_WORKBOOK_SHEETS.find((value) => value.name === sheet)!;
  const fallback = issue.itemType === "account_dimension_policy" ? "accountLogicalKey" : "logicalKey";
  const column = definition.columns.some((value) => value.name === issue.field) ? issue.field : fallback;
  const columnIndex = definition.columns.findIndex((value) => value.name === column);
  return Object.freeze({ sheet, row, column, address: `${excelColumn(columnIndex + 1)}${row}` });
}

function excelColumn(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function importRepositories(repositories: AccountingUnitOfWorkRepositories) {
  if (!repositories.codingTemplates || !repositories.codingTemplateVersions || !repositories.codingTemplateImports) {
    throw new CodingTemplateWorkbookImportError("repository_unavailable", null);
  }
  return { templates: repositories.codingTemplates, versions: repositories.codingTemplateVersions, imports: repositories.codingTemplateImports };
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new CodingTemplateWorkbookImportError("invalid_identifier", field);
  return normalized;
}

function normalizeFingerprint(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new CodingTemplateWorkbookImportError("invalid_identifier", "fileFingerprint");
  return normalized;
}
