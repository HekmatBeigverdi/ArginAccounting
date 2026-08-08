import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";

export const CODING_TEMPLATE_WORKBOOK_CONTRACT_VERSION = "1.0" as const;

export const CODING_TEMPLATE_WORKBOOK_LIMITS = Object.freeze({
  maximumFileSizeBytes: 5 * 1024 * 1024,
  maximumWorksheetCount: 5,
  maximumColumnsPerWorksheet: 32,
  maximumAccounts: 10_000,
  maximumDimensionTypes: 100,
  maximumDimensionMembers: 20_000,
  maximumAccountDimensionPolicies: 30_000,
});

export type CodingTemplateWorkbookSheetName =
  | "Metadata"
  | "Accounts"
  | "DimensionTypes"
  | "DimensionMembers"
  | "AccountDimensionPolicies";

export type CodingTemplateWorkbookColumnType =
  | "text"
  | "integer"
  | "boolean"
  | "enumeration"
  | "nullable_text"
  | "text_list";

export interface CodingTemplateWorkbookColumn {
  readonly name: string;
  readonly type: CodingTemplateWorkbookColumnType;
  readonly required: boolean;
  readonly allowedValues?: readonly string[];
  readonly example: string;
}

export interface CodingTemplateWorkbookSheet {
  readonly name: CodingTemplateWorkbookSheetName;
  readonly maximumDataRows: number;
  readonly columns: readonly Readonly<CodingTemplateWorkbookColumn>[];
}

const bool = ["true", "false"] as const;

export const CODING_TEMPLATE_WORKBOOK_SHEETS: readonly Readonly<CodingTemplateWorkbookSheet>[] = Object.freeze([
  sheet("Metadata", 1, [
    column("contractVersion", "enumeration", true, "1.0", [CODING_TEMPLATE_WORKBOOK_CONTRACT_VERSION]),
    column("templateCode", "text", true, "custom-service-01"),
    column("persianName", "text", true, "الگوی خدماتی سفارشی"),
    column("englishName", "nullable_text", false, "Custom service template"),
    column("activityType", "enumeration", true, "service", ["service", "trading", "manufacturing", "custom"]),
  ]),
  sheet("Accounts", CODING_TEMPLATE_WORKBOOK_LIMITS.maximumAccounts, [
    column("logicalKey", "text", true, "assets.cash"),
    column("parentLogicalKey", "nullable_text", false, "assets"),
    column("level", "enumeration", true, "subsidiary", ["group", "general", "subsidiary"]),
    column("code", "text", true, "110101"),
    column("persianName", "text", true, "صندوق ریالی"),
    column("englishName", "nullable_text", false, "Cash on hand"),
    column("nature", "enumeration", true, "debit", ["uncontrolled", "debit", "credit", "strict_debit", "strict_credit"]),
    column("normalBalance", "enumeration", true, "debit", ["debit", "credit"]),
    column("statementType", "enumeration", true, "balance_sheet", ["balance_sheet", "income_statement", "memorandum"]),
    column("balanceSheetSection", "enumeration", false, "assets", ["assets", "liabilities", "equity"]),
    column("incomeStatementSection", "enumeration", false, "revenue", ["revenue", "cost_of_sales", "operating_expenses", "non_operating", "finance_costs", "income_tax"]),
    column("cashFlowCategory", "enumeration", false, "operating", ["operating", "investing", "financing", "cash_and_cash_equivalents", "non_cash"]),
    column("cashEquivalent", "boolean", true, "false", bool),
    column("receivable", "boolean", true, "false", bool),
    column("payable", "boolean", true, "false", bool),
    column("managementTags", "text_list", false, "cash|current_asset"),
    column("postingAllowed", "boolean", true, "true", bool),
    column("currencyEnabled", "boolean", true, "false", bool),
    column("revaluationEnabled", "boolean", true, "false", bool),
    column("trackingEnabled", "boolean", true, "false", bool),
    column("dueDateEnabled", "boolean", true, "false", bool),
    column("activeByDefault", "boolean", true, "true", bool),
    column("displayOrder", "integer", true, "10"),
  ]),
  sheet("DimensionTypes", CODING_TEMPLATE_WORKBOOK_LIMITS.maximumDimensionTypes, [
    column("logicalKey", "text", true, "cost_center"),
    column("code", "text", true, "COST_CENTER"),
    column("persianName", "text", true, "مرکز هزینه"),
    column("englishName", "nullable_text", false, "Cost centre"),
    column("hierarchical", "boolean", true, "true", bool),
    column("allowMultipleMembers", "boolean", true, "false", bool),
    column("activeByDefault", "boolean", true, "true", bool),
    column("displayOrder", "integer", true, "10"),
  ]),
  sheet("DimensionMembers", CODING_TEMPLATE_WORKBOOK_LIMITS.maximumDimensionMembers, [
    column("logicalKey", "text", true, "cost_center.head_office"),
    column("dimensionTypeLogicalKey", "text", true, "cost_center"),
    column("parentLogicalKey", "nullable_text", false, ""),
    column("code", "text", true, "HEAD_OFFICE"),
    column("persianName", "text", true, "دفتر مرکزی"),
    column("englishName", "nullable_text", false, "Head office"),
    column("activeByDefault", "boolean", true, "true", bool),
    column("displayOrder", "integer", true, "10"),
  ]),
  sheet("AccountDimensionPolicies", CODING_TEMPLATE_WORKBOOK_LIMITS.maximumAccountDimensionPolicies, [
    column("accountLogicalKey", "text", true, "expenses.office"),
    column("dimensionTypeLogicalKey", "text", true, "cost_center"),
    column("requirement", "enumeration", true, "required", ["required", "optional", "forbidden"]),
  ]),
]);

export type CodingTemplateWorkbookIssueCode =
  | "file_too_large"
  | "worksheet_missing"
  | "worksheet_unexpected"
  | "worksheet_limit_exceeded"
  | "row_limit_exceeded"
  | "column_missing"
  | "column_unexpected"
  | "cell_required"
  | "cell_type_invalid"
  | "cell_value_invalid"
  | "formula_not_allowed"
  | "contract_version_unsupported"
  | "workbook_unreadable";

export interface CodingTemplateWorkbookCellLocation {
  readonly sheet: CodingTemplateWorkbookSheetName;
  readonly row: number;
  readonly column: string;
  readonly address: string;
}

export interface CodingTemplateWorkbookIssue {
  readonly code: CodingTemplateWorkbookIssueCode;
  readonly message: string;
  readonly location: Readonly<CodingTemplateWorkbookCellLocation> | null;
}

export type CodingTemplateWorkbookCell =
  | { readonly kind: "blank" }
  | { readonly kind: "stored"; readonly value: string | number | boolean }
  | { readonly kind: "formula"; readonly expression: string; readonly cachedValue?: string | number | boolean };

export interface CodingTemplateWorkbookSource {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface CodingTemplateWorkbookMetadata {
  readonly contractVersion: typeof CODING_TEMPLATE_WORKBOOK_CONTRACT_VERSION;
  readonly templateCode: string;
  readonly persianName: string;
  readonly englishName: string | null;
  readonly activityType: "service" | "trading" | "manufacturing" | "custom";
}

export interface CodingTemplateWorkbookParseSuccess {
  readonly success: true;
  readonly metadata: Readonly<CodingTemplateWorkbookMetadata>;
  readonly content: Readonly<CodingTemplateVersionContent>;
  readonly issues: readonly [];
}

export interface CodingTemplateWorkbookParseFailure {
  readonly success: false;
  readonly metadata: null;
  readonly content: null;
  readonly issues: readonly Readonly<CodingTemplateWorkbookIssue>[];
}

export type CodingTemplateWorkbookParseResult =
  | CodingTemplateWorkbookParseSuccess
  | CodingTemplateWorkbookParseFailure;

export interface CodingTemplateWorkbookParser {
  parse(source: Readonly<CodingTemplateWorkbookSource>): Promise<CodingTemplateWorkbookParseResult>;
}

export function normalizeCodingTemplateWorkbookText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10))
    .replace(/[\u00A0\u2007\u202F\t\r\n ]+/g, " ")
    .trim();
}

export function normalizeCodingTemplateWorkbookCell(
  cell: CodingTemplateWorkbookCell,
  location: Readonly<CodingTemplateWorkbookCellLocation>,
): { readonly value: string | number | boolean | null; readonly issue: CodingTemplateWorkbookIssue | null } {
  if (cell.kind === "formula") {
    return {
      value: null,
      issue: Object.freeze({
        code: "formula_not_allowed",
        message: "فرمول در این سلول مجاز نیست؛ مقدار ذخیره‌شده وارد کنید.",
        location: Object.freeze({ ...location }),
      }),
    };
  }
  if (cell.kind === "blank") return { value: null, issue: null };
  return {
    value: typeof cell.value === "string" ? normalizeCodingTemplateWorkbookText(cell.value) : cell.value,
    issue: null,
  };
}

function sheet(name: CodingTemplateWorkbookSheetName, maximumDataRows: number, columns: readonly CodingTemplateWorkbookColumn[]): CodingTemplateWorkbookSheet {
  return Object.freeze({ name, maximumDataRows, columns: Object.freeze(columns) });
}

function column(name: string, type: CodingTemplateWorkbookColumnType, required: boolean, example: string, allowedValues?: readonly string[]): CodingTemplateWorkbookColumn {
  return Object.freeze({ name, type, required, example, ...(allowedValues ? { allowedValues: Object.freeze([...allowedValues]) } : {}) });
}
