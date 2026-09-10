import { read, utils, write, type WorkBook, type WorkSheet } from "xlsx";

export const INVENTORY_TABULAR_LIMITS = Object.freeze({
  maximumFileSizeBytes: 20 * 1024 * 1024,
  maximumRows: 100_000,
  maximumColumns: 50,
});

export type InventoryTabularRow = Readonly<Record<string, string>>;

export interface InventoryTabularData {
  readonly headers: readonly string[];
  readonly rows: readonly InventoryTabularRow[];
}

export class InventoryTabularCodecError extends Error {
  constructor(
    readonly code:
      | "inventory.import.file-too-large"
      | "inventory.import.unreadable"
      | "inventory.import.row-limit"
      | "inventory.import.column-limit"
      | "inventory.import.empty",
    message: string,
  ) {
    super(message);
    this.name = "InventoryTabularCodecError";
  }
}

export const INVENTORY_IMPORT_TEMPLATE_HEADERS = Object.freeze([
  "کلید سند",
  "نوع سند",
  "تاریخ",
  "شرح سند",
  "کد کالا",
  "مقدار",
  "کد واحد",
  "کد انبار",
  "کد ناحیه",
  "کد موقعیت",
  "کد انبار مقصد",
  "کد ناحیه مقصد",
  "کد موقعیت مقصد",
  "شرح ردیف",
]);

export function parseInventoryXlsx(bytes: Uint8Array): InventoryTabularData {
  assertSize(bytes.byteLength);
  return parseSheet(firstSheet(readWorkbook(() => read(bytes, {
    type: "array",
    cellDates: false,
    cellFormula: false,
    raw: false,
  }))));
}

export function parseInventoryCsv(text: string): InventoryTabularData {
  assertSize(new TextEncoder().encode(text).byteLength);
  return parseSheet(firstSheet(readWorkbook(() => read(text, { type: "string", raw: false }))));
}

export function createInventoryXlsx(
  rows: readonly Readonly<Record<string, string | number | null | undefined>>[],
  sheetName = "Inventory",
): Uint8Array {
  const sheet = utils.json_to_sheet(rows.map((row) => ({ ...row })));
  sheet["!rtl"] = true;
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31) || "Inventory");
  const output = write(workbook, { type: "array", bookType: "xlsx", compression: true });
  return output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
}

export function createInventoryImportTemplateXlsx(): Uint8Array {
  const template = Object.fromEntries(INVENTORY_IMPORT_TEMPLATE_HEADERS.map((header) => [header, ""]));
  const sheet = utils.json_to_sheet([template], { header: [...INVENTORY_IMPORT_TEMPLATE_HEADERS] });
  sheet["!rtl"] = true;
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Import Template");
  const output = write(workbook, { type: "array", bookType: "xlsx", compression: true });
  return output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
}

function assertSize(byteLength: number): void {
  if (byteLength > INVENTORY_TABULAR_LIMITS.maximumFileSizeBytes) {
    throw new InventoryTabularCodecError("inventory.import.file-too-large", "Inventory import file exceeds 20 MB.");
  }
}

function readWorkbook(load: () => WorkBook): WorkBook {
  try {
    return load();
  } catch {
    throw new InventoryTabularCodecError("inventory.import.unreadable", "Inventory tabular file cannot be read.");
  }
}

function firstSheet(workbook: WorkBook): WorkSheet {
  const name = workbook.SheetNames[0];
  const sheet = name ? workbook.Sheets[name] : undefined;
  if (!sheet) throw new InventoryTabularCodecError("inventory.import.empty", "Inventory tabular file has no worksheet.");
  return sheet;
}

function parseSheet(sheet: WorkSheet): InventoryTabularData {
  const matrix = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (matrix.length === 0) throw new InventoryTabularCodecError("inventory.import.empty", "Inventory tabular file is empty.");
  const headers = (matrix[0] ?? []).map(normalizeCell);
  if (headers.length > INVENTORY_TABULAR_LIMITS.maximumColumns) {
    throw new InventoryTabularCodecError("inventory.import.column-limit", "Inventory import has too many columns.");
  }
  const data = matrix.slice(1).filter((row) => row.some((cell) => normalizeCell(cell) !== ""));
  if (data.length > INVENTORY_TABULAR_LIMITS.maximumRows) {
    throw new InventoryTabularCodecError("inventory.import.row-limit", "Inventory import has too many rows.");
  }
  const rows = data.map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) row[header] = normalizeCell(values[index]);
    });
    return Object.freeze(row);
  });
  return Object.freeze({ headers: Object.freeze(headers), rows: Object.freeze(rows) });
}

const normalizeCell = (value: unknown): string => String(value ?? "").trim();
