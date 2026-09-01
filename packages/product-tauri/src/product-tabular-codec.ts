import type { ProductExportRow, ProductTabularRow } from "@argin/product";
import { read, utils, write, type WorkBook, type WorkSheet } from "xlsx";

export const PRODUCT_TABULAR_LIMITS = Object.freeze({
  maximumFileSizeBytes: 20 * 1024 * 1024,
  maximumRows: 100_000,
  maximumColumns: 100,
});

export interface ProductTabularData {
  readonly headers: readonly string[];
  readonly rows: readonly ProductTabularRow[];
}

export type ProductTabularCodecErrorCode =
  | "product.import.file-too-large"
  | "product.import.unreadable"
  | "product.import.row-limit"
  | "product.import.column-limit"
  | "product.import.empty";

export class ProductTabularCodecError extends Error {
  constructor(readonly code: ProductTabularCodecErrorCode, message: string) {
    super(message);
    this.name = "ProductTabularCodecError";
  }
}

export function parseProductXlsx(bytes: Uint8Array): ProductTabularData {
  assertFileSize(bytes.byteLength, "Excel");
  const workbook = readWorkbook(
    () => read(bytes, { type: "array", cellDates: false, cellFormula: false, dense: false }),
    "Product Excel file cannot be read.",
  );
  return parseWorksheet(firstWorksheet(workbook, "Product Excel file has no worksheet."));
}

export function parseProductCsv(text: string): ProductTabularData {
  const byteLength = new TextEncoder().encode(text).byteLength;
  assertFileSize(byteLength, "CSV");
  const workbook = readWorkbook(
    () => read(text, { type: "string", raw: true }),
    "Product CSV file cannot be read.",
  );
  return parseWorksheet(firstWorksheet(workbook, "Product CSV file is empty."));
}

export function createProductXlsx(rows: readonly ProductExportRow[]): Uint8Array {
  const sheet = createWorksheet(rows.map(toRecord));
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Products");
  const output = write(workbook, { type: "array", bookType: "xlsx", compression: true });
  return output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
}

export function createProductCsv(rows: readonly ProductExportRow[]): string {
  return utils.sheet_to_csv(createWorksheet(rows.map(toRecord)));
}

function assertFileSize(byteLength: number, fileType: "Excel" | "CSV"): void {
  if (byteLength > PRODUCT_TABULAR_LIMITS.maximumFileSizeBytes) {
    throw new ProductTabularCodecError(
      "product.import.file-too-large",
      `Product ${fileType} file exceeds the allowed size.`,
    );
  }
}

function readWorkbook(load: () => WorkBook, unreadableMessage: string): WorkBook {
  try {
    return load();
  } catch {
    throw new ProductTabularCodecError("product.import.unreadable", unreadableMessage);
  }
}

function firstWorksheet(workbook: WorkBook, emptyMessage: string): WorkSheet {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!sheet) {
    throw new ProductTabularCodecError("product.import.empty", emptyMessage);
  }
  return sheet;
}

function parseWorksheet(sheet: WorkSheet): ProductTabularData {
  const matrix = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (matrix.length === 0) {
    throw new ProductTabularCodecError("product.import.empty", "Product tabular file is empty.");
  }

  const headers = (matrix[0] ?? []).map(normalizeCell);
  if (headers.length > PRODUCT_TABULAR_LIMITS.maximumColumns) {
    throw new ProductTabularCodecError(
      "product.import.column-limit",
      "Product tabular file has too many columns.",
    );
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > PRODUCT_TABULAR_LIMITS.maximumRows) {
    throw new ProductTabularCodecError(
      "product.import.row-limit",
      "Product tabular file has too many rows.",
    );
  }

  return Object.freeze({
    headers: Object.freeze(headers),
    rows: Object.freeze(dataRows.map((values) => mapTabularRow(headers, values))),
  });
}

function createWorksheet(rows: readonly Record<string, string>[]): WorkSheet {
  return utils.json_to_sheet([...rows]);
}

function mapTabularRow(
  headers: readonly string[],
  values: readonly unknown[],
): ProductTabularRow {
  const row: Record<string, string> = {};
  for (const [index, header] of headers.entries()) {
    if (header) row[header] = normalizeCell(values[index]);
  }
  return Object.freeze(row);
}

function normalizeCell(value: unknown): string {
  return String(value ?? "").trim();
}

function toRecord(row: ProductExportRow): Record<string, string> {
  return { ...row };
}
