import {
  CODING_TEMPLATE_WORKBOOK_LIMITS,
  CODING_TEMPLATE_WORKBOOK_SHEETS,
  normalizeCodingTemplateWorkbookCell,
  type CodingTemplateVersionContent,
  type CodingTemplateWorkbookCell,
  type CodingTemplateWorkbookCellLocation,
  type CodingTemplateWorkbookIssue,
  type CodingTemplateWorkbookFingerprintProvider,
  type CodingTemplateWorkbookMetadata,
  type CodingTemplateWorkbookParseResult,
  type CodingTemplateWorkbookParser,
  type CodingTemplateWorkbookSheet,
  type CodingTemplateWorkbookSource,
} from "@argin/accounting";
import { read, utils, type CellObject, type WorkBook, type WorkSheet } from "xlsx";

type Value = string | number | boolean | null;
type Row = Readonly<Record<string, Value>>;

export class XlsxCodingTemplateWorkbookParser implements CodingTemplateWorkbookParser {
  async parse(source: Readonly<CodingTemplateWorkbookSource>): Promise<CodingTemplateWorkbookParseResult> {
    const issues: CodingTemplateWorkbookIssue[] = [];
    if (source.bytes.byteLength > CODING_TEMPLATE_WORKBOOK_LIMITS.maximumFileSizeBytes) {
      return failure([issue("file_too_large", "حجم فایل Excel از حد مجاز بیشتر است.", null)]);
    }

    let workbook: WorkBook;
    try {
      workbook = read(source.bytes, { type: "array", cellFormula: true, cellNF: false, cellHTML: false, cellDates: false, dense: false });
    } catch {
      return failure([issue("workbook_unreadable", "فایل Excel قابل خواندن نیست.", null)]);
    }

    if (workbook.SheetNames.length > CODING_TEMPLATE_WORKBOOK_LIMITS.maximumWorksheetCount) {
      issues.push(issue("worksheet_limit_exceeded", "تعداد Sheetهای فایل از حد مجاز بیشتر است.", null));
    }
    const expected = new Set(CODING_TEMPLATE_WORKBOOK_SHEETS.map((sheet) => sheet.name));
    for (const name of workbook.SheetNames) if (!expected.has(name as never)) issues.push(issue("worksheet_unexpected", `Sheet ناشناخته است: ${name}`, null));

    const rows = new Map<string, readonly Row[]>();
    for (const definition of CODING_TEMPLATE_WORKBOOK_SHEETS) {
      const worksheet = workbook.Sheets[definition.name];
      if (!worksheet) {
        issues.push(issue("worksheet_missing", `Sheet الزامی ${definition.name} وجود ندارد.`, null));
        continue;
      }
      rows.set(definition.name, parseSheet(worksheet, definition, issues));
    }
    if (issues.length) return failure(issues);

    const metadataRow = rows.get("Metadata")?.[0];
    if (!metadataRow) return failure([issue("cell_required", "ردیف Metadata الزامی است.", location("Metadata", 2, "contractVersion", "A2"))]);
    const metadata: CodingTemplateWorkbookMetadata = Object.freeze({
      contractVersion: text(metadataRow, "contractVersion") as "1.0",
      templateCode: text(metadataRow, "templateCode"),
      persianName: text(metadataRow, "persianName"),
      englishName: nullableText(metadataRow, "englishName"),
      activityType: text(metadataRow, "activityType") as CodingTemplateWorkbookMetadata["activityType"],
    });
    const content: CodingTemplateVersionContent = Object.freeze({
      accounts: Object.freeze((rows.get("Accounts") ?? []).map(account)),
      dimensionTypes: Object.freeze((rows.get("DimensionTypes") ?? []).map(dimensionType)),
      dimensionMembers: Object.freeze((rows.get("DimensionMembers") ?? []).map(dimensionMember)),
      accountDimensionPolicies: Object.freeze((rows.get("AccountDimensionPolicies") ?? []).map(policy)),
    });
    return Object.freeze({ success: true, metadata, content, issues: [] as const });
  }
}

export class WebCryptoCodingTemplateWorkbookFingerprintProvider implements CodingTemplateWorkbookFingerprintProvider {
  async sha256(bytes: Uint8Array): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  }
}

function parseSheet(worksheet: WorkSheet, definition: Readonly<CodingTemplateWorkbookSheet>, issues: CodingTemplateWorkbookIssue[]): readonly Row[] {
  const matrix = utils.sheet_to_json<Value[]>(worksheet, { header: 1, raw: true, defval: null, blankrows: false });
  const header = (matrix[0] ?? []).map((value) => String(value ?? "").trim());
  const expected = definition.columns.map((column) => column.name);
  for (const name of expected) if (!header.includes(name)) issues.push(issue("column_missing", `ستون الزامی ${name} وجود ندارد.`, null));
  for (const name of header) if (name && !expected.includes(name)) issues.push(issue("column_unexpected", `ستون ناشناخته ${name} وجود دارد.`, null));
  const data = matrix.slice(1);
  if (data.length > definition.maximumDataRows) issues.push(issue("row_limit_exceeded", `تعداد ردیف‌های Sheet ${definition.name} از حد مجاز بیشتر است.`, null));

  return Object.freeze(data.slice(0, definition.maximumDataRows).map((_values, rowIndex) => {
    const result: Record<string, Value> = {};
    for (const column of definition.columns) {
      const columnIndex = header.indexOf(column.name);
      const address = `${excelColumn(columnIndex + 1)}${rowIndex + 2}`;
      const cellLocation = location(definition.name, rowIndex + 2, column.name, address);
      const cell = columnIndex < 0 ? { kind: "blank" as const } : workbookCell(worksheet[address]);
      const normalized = normalizeCodingTemplateWorkbookCell(cell, cellLocation);
      if (normalized.issue) issues.push(normalized.issue);
      const value = normalized.value;
      if (column.required && (value === null || value === "")) issues.push(issue("cell_required", "مقدار این سلول الزامی است.", cellLocation));
      else if (value !== null && !validType(value, column.type)) issues.push(issue("cell_type_invalid", "نوع مقدار سلول معتبر نیست.", cellLocation));
      else if (value !== null && column.allowedValues && !column.allowedValues.includes(String(value).toLowerCase())) issues.push(issue("cell_value_invalid", "مقدار سلول در فهرست مقادیر مجاز نیست.", cellLocation));
      result[column.name] = coerce(value, column.type);
    }
    return Object.freeze(result);
  }));
}

function workbookCell(cell: CellObject | undefined): CodingTemplateWorkbookCell {
  if (!cell || cell.v === undefined || cell.v === null) return { kind: "blank" };
  if (cell.f) return { kind: "formula", expression: cell.f, ...(primitive(cell.v) !== null ? { cachedValue: primitive(cell.v)! } : {}) };
  const value = primitive(cell.v);
  return value === null ? { kind: "blank" } : { kind: "stored", value };
}

function primitive(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}

function validType(value: Exclude<Value, null>, type: CodingTemplateWorkbookSheet["columns"][number]["type"]): boolean {
  if (type === "integer") return typeof value === "number" ? Number.isSafeInteger(value) : typeof value === "string" && /^\d+$/.test(value);
  if (type === "boolean") return typeof value === "boolean" || (typeof value === "string" && ["true", "false"].includes(value.toLowerCase()));
  return typeof value === "string";
}

function coerce(value: Value, type: CodingTemplateWorkbookSheet["columns"][number]["type"]): Value {
  if (value === null) return null;
  if (type === "integer") return typeof value === "number" ? value : Number(value);
  if (type === "boolean") return typeof value === "boolean" ? value : typeof value === "string" && value.toLowerCase() === "true";
  return typeof value === "string" ? value : String(value);
}

function account(row: Row): CodingTemplateVersionContent["accounts"][number] {
  return Object.freeze({
    logicalKey: text(row, "logicalKey"), parentLogicalKey: nullableText(row, "parentLogicalKey"), level: text(row, "level") as "group" | "general" | "subsidiary", code: text(row, "code"), persianName: text(row, "persianName"), englishName: nullableText(row, "englishName"), nature: text(row, "nature") as never, normalBalance: text(row, "normalBalance") as "debit" | "credit", statementType: text(row, "statementType") as never,
    reportClassification: Object.freeze({ balanceSheetSection: nullableText(row, "balanceSheetSection") as never, incomeStatementSection: nullableText(row, "incomeStatementSection") as never, cashFlowCategory: nullableText(row, "cashFlowCategory") as never, cashEquivalent: bool(row, "cashEquivalent"), receivable: bool(row, "receivable"), payable: bool(row, "payable"), managementTags: textList(row, "managementTags") }),
    postingAllowed: bool(row, "postingAllowed"), currencyEnabled: bool(row, "currencyEnabled"), revaluationEnabled: bool(row, "revaluationEnabled"), trackingEnabled: bool(row, "trackingEnabled"), dueDateEnabled: bool(row, "dueDateEnabled"), activeByDefault: bool(row, "activeByDefault"), displayOrder: integer(row, "displayOrder"),
  });
}

function dimensionType(row: Row): CodingTemplateVersionContent["dimensionTypes"][number] {
  return Object.freeze({ logicalKey: text(row, "logicalKey"), code: text(row, "code"), persianName: text(row, "persianName"), englishName: nullableText(row, "englishName"), hierarchical: bool(row, "hierarchical"), allowMultipleMembers: bool(row, "allowMultipleMembers"), activeByDefault: bool(row, "activeByDefault"), displayOrder: integer(row, "displayOrder") });
}

function dimensionMember(row: Row): CodingTemplateVersionContent["dimensionMembers"][number] {
  return Object.freeze({ logicalKey: text(row, "logicalKey"), dimensionTypeLogicalKey: text(row, "dimensionTypeLogicalKey"), parentLogicalKey: nullableText(row, "parentLogicalKey"), code: text(row, "code"), persianName: text(row, "persianName"), englishName: nullableText(row, "englishName"), activeByDefault: bool(row, "activeByDefault"), displayOrder: integer(row, "displayOrder") });
}

function policy(row: Row): CodingTemplateVersionContent["accountDimensionPolicies"][number] {
  return Object.freeze({ accountLogicalKey: text(row, "accountLogicalKey"), dimensionTypeLogicalKey: text(row, "dimensionTypeLogicalKey"), requirement: text(row, "requirement") as "required" | "optional" | "forbidden" });
}

const text = (row: Row, field: string) => String(row[field] ?? "");
const nullableText = (row: Row, field: string) => row[field] === null || row[field] === "" ? null : String(row[field]);
const bool = (row: Row, field: string) => row[field] === true;
const integer = (row: Row, field: string) => Number(row[field]);
const textList = (row: Row, field: string) => text(row, field).split("|").map((value) => value.trim()).filter(Boolean);
const failure = (issues: readonly CodingTemplateWorkbookIssue[]): CodingTemplateWorkbookParseResult => Object.freeze({ success: false, metadata: null, content: null, issues: Object.freeze([...issues]) });
const issue = (code: CodingTemplateWorkbookIssue["code"], message: string, cellLocation: CodingTemplateWorkbookCellLocation | null): CodingTemplateWorkbookIssue => Object.freeze({ code, message, location: cellLocation });
const location = (sheet: CodingTemplateWorkbookCellLocation["sheet"], row: number, column: string, address: string): CodingTemplateWorkbookCellLocation => Object.freeze({ sheet, row, column, address });

function excelColumn(index: number): string {
  let value = index; let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}
