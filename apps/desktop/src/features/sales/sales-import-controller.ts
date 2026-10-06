import { createInventoryXlsx, type InventoryTabularData } from "@argin/inventory-tauri";
import type { SalesDocumentType } from "@argin/sales";
import type { SalesWorkspaceServices } from "../../composition/sales/create-sales-workspace-services";

export const SALES_IMPORT_HEADERS = Object.freeze([
  "کلید سند",
  "نوع سند",
  "تاریخ",
  "کد مشتری",
  "شرح سند",
  "کد کالا",
  "تعداد",
  "قیمت واحد",
  "تخفیف درصد",
  "مالیات درصد",
]);

export function createSalesImportTemplateXlsx(): Uint8Array {
  return createInventoryXlsx(
    [Object.fromEntries(SALES_IMPORT_HEADERS.map((header) => [header, ""]))],
    "ورود اسناد فروش",
  );
}

interface SalesImportLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountRateBasisPoints: number;
  taxRateBasisPoints: number;
}

interface SalesImportDocumentInput {
  documentType: SalesDocumentType;
  customerId: string;
  businessDate: string;
  description: string;
  lines: readonly SalesImportLine[];
}

interface SalesImportContext {
  services: SalesWorkspaceServices;
  companyId: string;
  branchId: string;
}

type SalesImportRow = InventoryTabularData["rows"][number];

export interface SalesImportPreviewDocument {
  readonly key: string;
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly input: SalesImportDocumentInput | null;
}

export interface SalesImportPreview {
  readonly batchId: string;
  readonly totalRows: number;
  readonly documents: readonly SalesImportPreviewDocument[];
  readonly invalidCount: number;
}

export async function previewSalesImport(
  input: SalesImportContext & { data: InventoryTabularData; batchId: string },
): Promise<SalesImportPreview> {
  validateImportHeaders(input.data.headers);
  const rowsByDocumentKey = groupRowsByDocumentKey(input.data.rows);
  const documents: SalesImportPreviewDocument[] = [];

  for (const [key, rows] of rowsByDocumentKey) {
    documents.push(await previewImportDocument(key, rows, input));
  }

  return Object.freeze({
    batchId: input.batchId,
    totalRows: input.data.rows.length,
    documents: Object.freeze(documents),
    invalidCount: documents.filter((document) => !document.valid).length,
  });
}

function validateImportHeaders(headers: readonly string[]): void {
  const missingHeaders = SALES_IMPORT_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error("ستون‌های الزامی فایل وجود ندارند: " + missingHeaders.join("، "));
  }
}

function groupRowsByDocumentKey(rows: readonly SalesImportRow[]): Map<string, SalesImportRow[]> {
  const rowsByDocumentKey = new Map<string, SalesImportRow[]>();
  rows.forEach((row, index) => {
    const key = row["کلید سند"]?.trim();
    const documentKey = key || "__missing_" + index;
    rowsByDocumentKey.set(documentKey, [...(rowsByDocumentKey.get(documentKey) ?? []), row]);
  });
  return rowsByDocumentKey;
}

async function previewImportDocument(
  key: string,
  rows: readonly SalesImportRow[],
  context: SalesImportContext,
): Promise<SalesImportPreviewDocument> {
  const issues: string[] = [];
  if (key.startsWith("__missing_")) {
    issues.push("کلید سند الزامی است.");
  }
  const firstRow = rows[0]!;
  const documentType = parseDocumentType(firstRow["نوع سند"]);
  if (!documentType) {
    issues.push("نوع سند فقط «فاکتور فروش» یا «سفارش فروش» است.");
  }
  if (
    rows.some(
      (row) =>
        row["نوع سند"] !== firstRow["نوع سند"] ||
        row["تاریخ"] !== firstRow["تاریخ"] ||
        row["کد مشتری"] !== firstRow["کد مشتری"],
    )
  ) {
    issues.push("مشخصات سربرگ در ردیف‌های یک سند یکسان نیست.");
  }
  const customers = await context.services.selectCustomers(
    context.companyId,
    context.branchId,
    firstRow["کد مشتری"] ?? "",
  );
  const customer = customers.find(
    (customer) => customer.code === (firstRow["کد مشتری"] ?? "").trim(),
  );
  if (!customer) {
    issues.push("کد مشتری فعال پیدا نشد.");
  }

  const linePreview = await previewImportLines(rows, context);
  const lines = linePreview.lines;
  issues.push(...linePreview.issues);

  const businessDate = (firstRow["تاریخ"] ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    issues.push("تاریخ باید میلادی و به قالب YYYY-MM-DD باشد.");
  }
  let documentInput: SalesImportPreviewDocument["input"] = null;
  if (issues.length === 0 && documentType && customer) {
    documentInput = Object.freeze({
      documentType,
      customerId: customer.id,
      businessDate,
      description: (firstRow["شرح سند"] ?? "").trim(),
      lines: Object.freeze(lines),
    });
  }

  return Object.freeze({
    key,
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    input: documentInput,
  });
}

async function previewImportLines(
  rows: readonly SalesImportRow[],
  context: SalesImportContext,
): Promise<{ lines: SalesImportLine[]; issues: string[] }> {
  const lines: SalesImportLine[] = [];
  const issues: string[] = [];

  for (const [index, row] of rows.entries()) {
    const products = await context.services.selectItems(
      context.companyId,
      context.branchId,
      row["کد کالا"] ?? "",
    );
    const product = products.find((product) => product.code === (row["کد کالا"] ?? "").trim());
    if (!product) {
      issues.push("ردیف " + (index + 1) + ": کد کالا/خدمت فعال پیدا نشد.");
      continue;
    }
    const quantity = parseNumber(row["تعداد"]);
    const unitPrice = parseNumber(row["قیمت واحد"]);
    const discountRateBasisPoints = parsePercentBasisPoints(row["تخفیف درصد"]);
    const taxRateBasisPoints = parsePercentBasisPoints(row["مالیات درصد"]);
    if (!(quantity > 0)) {
      issues.push("ردیف " + (index + 1) + ": تعداد باید بیشتر از صفر باشد.");
    }
    if (unitPrice < 0 || !Number.isSafeInteger(unitPrice)) {
      issues.push("ردیف " + (index + 1) + ": قیمت واحد معتبر نیست.");
    }
    if (discountRateBasisPoints < 0 || discountRateBasisPoints > 10000) {
      issues.push("ردیف " + (index + 1) + ": تخفیف معتبر نیست.");
    }
    if (taxRateBasisPoints < 0 || taxRateBasisPoints > 10000) {
      issues.push("ردیف " + (index + 1) + ": مالیات معتبر نیست.");
    }
    lines.push({
      productId: product.productId,
      quantity,
      unitPrice,
      discountRateBasisPoints,
      taxRateBasisPoints,
    });
  }
  return { lines, issues };
}

export async function commitSalesImport(input: {
  preview: SalesImportPreview;
  services: SalesWorkspaceServices;
  companyId: string;
  branchId: string;
  fiscalYearId: string;
}): Promise<{ created: number }> {
  if (input.preview.invalidCount) {
    throw new Error("فایل دارای خطاست؛ ابتدا همه خطاهای پیش‌نمایش را برطرف کنید.");
  }
  let created = 0;
  for (const document of input.preview.documents) {
    if (!document.input) {
      throw new Error("پیش‌نمایش معتبر نیست.");
    }
    await input.services.create({
      submissionId: "sales-import:" + input.preview.batchId + ":" + document.key,
      companyId: input.companyId,
      branchId: input.branchId,
      fiscalYearId: input.fiscalYearId,
      documentType: document.input.documentType,
      customerId: document.input.customerId,
      businessDate: document.input.businessDate,
      description: document.input.description,
      relatedDocumentId: "",
      lines: document.input.lines,
    });
    created++;
  }
  return { created };
}

export async function salesImportBatchId(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseDocumentType(value: string | undefined): SalesDocumentType | null {
  switch (value?.trim()) {
    case "فاکتور فروش":
      return "sales-invoice";
    case "سفارش فروش":
      return "sales-order";
    default:
      return null;
  }
}

function parseNumber(value: string | undefined): number {
  return Number(
    String(value ?? "")
      .replaceAll(",", "")
      .trim(),
  );
}

function parsePercentBasisPoints(value: string | undefined): number {
  const percentage = parseNumber(value);
  return Number.isFinite(percentage) ? Math.round(percentage * 100) : -1;
}
