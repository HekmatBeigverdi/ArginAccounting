import type { PartyExportRow, PartyMasterExportRow, PartyTabularRow } from "@argin/party";
import { read, utils, write, type WorkBook, type WorkSheet } from "xlsx";

export const PARTY_TABULAR_LIMITS = Object.freeze({
  maximumFileSizeBytes: 20 * 1024 * 1024,
  maximumRows: 100_000,
  maximumColumns: 100
});

export interface PartyTabularData {
  readonly headers: readonly string[];
  readonly rows: readonly PartyTabularRow[];
}

type PartyTabularCodecErrorCode =
  | "party.import.fileTooLarge"
  | "party.import.unreadable"
  | "party.import.rowLimit"
  | "party.import.columnLimit"
  | "party.import.empty";

export class PartyTabularCodecError extends Error {
  constructor(readonly code: PartyTabularCodecErrorCode, message: string) {
    super(message);
    this.name = "PartyTabularCodecError";
  }
}

export function parsePartyXlsx(bytes: Uint8Array): PartyTabularData {
  assertFileSize(bytes.byteLength, "Excel");
  const workbook = readWorkbook(
    () => read(bytes, { type: "array", cellDates: false, cellFormula: false, dense: false }),
    "Party Excel file cannot be read."
  );
  return parseWorksheet(firstWorksheet(workbook, "Party Excel file has no worksheet."));
}

export function parsePartyCsv(text: string): PartyTabularData {
  const byteLength = new TextEncoder().encode(text).byteLength;
  assertFileSize(byteLength, "CSV");
  const workbook = readWorkbook(
    () => read(text, { type: "string", raw: true }),
    "Party CSV file cannot be read."
  );
  return parseWorksheet(firstWorksheet(workbook, "Party CSV file is empty."));
}

export function createPartyXlsx(rows: readonly PartyExportRow[]): Uint8Array {
  return createXlsx(rows.map(toSummary));
}

export function createPartyCsv(rows: readonly PartyExportRow[]): string {
  return createCsv(rows.map(toSummary));
}

export function createPartyMasterXlsx(rows: readonly PartyMasterExportRow[]): Uint8Array {
  return createXlsx(rows.map(toMaster));
}

export function createPartyMasterCsv(rows: readonly PartyMasterExportRow[]): string {
  return createCsv(rows.map(toMaster));
}

function assertFileSize(byteLength: number, fileType: "Excel" | "CSV"): void {
  if (byteLength > PARTY_TABULAR_LIMITS.maximumFileSizeBytes) {
    throw new PartyTabularCodecError(
      "party.import.fileTooLarge",
      `Party ${fileType} file exceeds the allowed size.`
    );
  }
}

function readWorkbook(load: () => WorkBook, unreadableMessage: string): WorkBook {
  try {
    return load();
  } catch {
    throw new PartyTabularCodecError("party.import.unreadable", unreadableMessage);
  }
}

function firstWorksheet(workbook: WorkBook, emptyMessage: string): WorkSheet {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!sheet) {
    throw new PartyTabularCodecError("party.import.empty", emptyMessage);
  }
  return sheet;
}

function createXlsx(rows: readonly Record<string, string>[]): Uint8Array {
  const sheet = createWorksheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Parties");
  const output = write(workbook, { type: "array", bookType: "xlsx", compression: true });
  return output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
}

function createCsv(rows: readonly Record<string, string>[]): string {
  return utils.sheet_to_csv(createWorksheet(rows));
}

function createWorksheet(rows: readonly Record<string, string>[]): WorkSheet {
  // SheetJS declares a mutable array even though it only reads the input rows.
  return utils.json_to_sheet([...rows]);
}

function parseWorksheet(sheet: WorkSheet): PartyTabularData {
  const matrix = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false });
  if (matrix.length === 0) {
    throw new PartyTabularCodecError("party.import.empty", "Party tabular file is empty.");
  }

  const headers = (matrix[0] ?? []).map(normalizeCell);
  if (headers.length > PARTY_TABULAR_LIMITS.maximumColumns) {
    throw new PartyTabularCodecError(
      "party.import.columnLimit",
      "Party tabular file has too many columns."
    );
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > PARTY_TABULAR_LIMITS.maximumRows) {
    throw new PartyTabularCodecError(
      "party.import.rowLimit",
      "Party tabular file has too many rows."
    );
  }

  const rows = dataRows.map((values) => mapTabularRow(headers, values));
  return Object.freeze({ headers: Object.freeze(headers), rows: Object.freeze(rows) });
}

function mapTabularRow(headers: readonly string[], values: readonly unknown[]): PartyTabularRow {
  const row: Record<string, string> = {};
  for (const [index, header] of headers.entries()) {
    if (header) row[header] = normalizeCell(values[index]);
  }
  return Object.freeze(row);
}

function normalizeCell(value: unknown): string {
  return String(value ?? "").trim();
}

function toSummary(row: PartyExportRow): Record<string, string> {
  return {
    id: row.id,
    code: row.code,
    classification: row.classification,
    displayName: row.displayName,
    status: row.status,
    roles: row.roles,
    primaryPhone: row.primaryPhone,
    primaryMobile: row.primaryMobile,
    primaryEmail: row.primaryEmail,
    updatedAt: row.updatedAt
  };
}

function toMaster(row: PartyMasterExportRow): Record<string, string> {
  return {
    id: row.id,
    classification: row.classification,
    code: row.code,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    legalName: row.legalName,
    tradeName: row.tradeName,
    nationalCode: row.nationalCode,
    nationalId: row.nationalId,
    registrationNumber: row.registrationNumber,
    economicNumber: row.economicNumber,
    legacyEconomicCode: row.legacyEconomicCode,
    taxFileNumber: row.taxFileNumber,
    roles: row.roles,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
