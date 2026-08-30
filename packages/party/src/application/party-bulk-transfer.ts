import {
  createParty,
  type CreateLegalEntityPartyInput,
  type CreateNaturalPersonPartyInput,
  type Party,
  type PartyRole
} from "../domain/party.ts";
import type { PartyDuplicateLookup, PartyDuplicateProbe } from "./contracts/party-duplicate.ts";
import type { PartyReader } from "./contracts/party-reader.ts";
import type { PartyUnitOfWork } from "./contracts/party-unit-of-work.ts";
import type { PartyAuditSink, PartyAuthorizationPolicy } from "./contracts/party-security.ts";
import { partyPermissions } from "./contracts/party-security.ts";

export const partyImportFields = [
  "classification", "code", "firstName", "lastName", "legalName", "tradeName",
  "nationalCode", "nationalId", "registrationNumber", "economicNumber", "legacyEconomicCode", "taxFileNumber",
  "roles", "phone", "mobile", "email", "addressLine", "postalCode"
] as const;

export type PartyImportField = (typeof partyImportFields)[number];
export type PartyImportColumnMap = Readonly<Partial<Record<PartyImportField, string>>>;
export type PartyTabularRow = Readonly<Record<string, string | null | undefined>>;

type PartyImportCreateInput =
  | Omit<CreateNaturalPersonPartyInput, "id" | "companyId" | "createdAt">
  | Omit<CreateLegalEntityPartyInput, "id" | "companyId" | "createdAt">;

export interface PartyImportContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface PartyImportIssue { readonly code: string; readonly message: string; }
export interface PartyImportPreviewRow {
  readonly rowNumber: number;
  readonly displayName: string | null;
  readonly code: string | null;
  readonly valid: boolean;
  readonly issues: readonly PartyImportIssue[];
  readonly advisoryDuplicatePartyIds: readonly string[];
  readonly hardDuplicatePartyIds: readonly string[];
}
export interface PartyImportPreview {
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly rows: readonly PartyImportPreviewRow[];
}
export interface PartyImportResult {
  readonly importedCount: number;
  readonly failedCount: number;
  readonly atomic: boolean;
  readonly failures: readonly PartyImportPreviewRow[];
}
export interface PartyImportIdGenerator { nextId(): string; }
export interface PartyExportRow {
  readonly id: string;
  readonly code: string;
  readonly classification: string;
  readonly displayName: string;
  readonly status: string;
  readonly roles: string;
  readonly primaryPhone: string;
  readonly primaryMobile: string;
  readonly primaryEmail: string;
  readonly updatedAt: string;
}
export interface PartyExportBatchSink { write(rows: readonly PartyExportRow[]): Promise<void>; }

interface PreparedRow {
  readonly rowNumber: number;
  readonly createInput: PartyImportCreateInput;
  readonly previewParty: Party;
  readonly preview: PartyImportPreviewRow;
}

const batchDuplicateIssue = {
  code: "party.import.batchDuplicate",
  message: "Duplicate Party code or official identifier exists in the import batch."
} as const;

export class PartyBulkTransferService {
  constructor(
    private readonly unitOfWork: PartyUnitOfWork,
    private readonly duplicateLookup: PartyDuplicateLookup,
    private readonly reader: PartyReader,
    private readonly authorization: PartyAuthorizationPolicy,
    private readonly audit: PartyAuditSink,
    private readonly ids: PartyImportIdGenerator
  ) {}

  async previewImport(rows: readonly PartyTabularRow[], mapping: PartyImportColumnMap, context: PartyImportContext): Promise<PartyImportPreview> {
    await this.authorization.require(authContext(context), partyPermissions.import);
    const preparedRows = await this.prepareRows(rows, mapping, context);
    return summarize(preparedRows.map((entry) => entry.preview));
  }

  async import(rows: readonly PartyTabularRow[], mapping: PartyImportColumnMap, context: PartyImportContext, options: { readonly atomic: boolean }): Promise<PartyImportResult> {
    await this.authorization.require(authContext(context), partyPermissions.import);
    const preparedRows = await this.prepareRows(rows, mapping, context);
    const failures = preparedRows
      .filter((entry) => !entry.preview.valid)
      .map((entry) => entry.preview);

    if (options.atomic && failures.length > 0) {
      return Object.freeze({ importedCount: 0, failedCount: failures.length, atomic: true, failures: Object.freeze(failures) });
    }

    const validRows = preparedRows.filter((entry) => entry.preview.valid);
    const writeResult = options.atomic
      ? await this.importAtomically(validRows, context)
      : await this.importBestEffort(validRows, context);
    const allFailures = [...failures, ...writeResult.failures];

    await this.audit.record(Object.freeze({
      action: "party.import", actorId: context.actorId, companyId: context.companyId, partyId: null,
      correlationId: context.correlationId, requestId: context.requestId, occurredAt: context.occurredAt,
      metadata: Object.freeze({ importedCount: writeResult.importedCount, failedCount: allFailures.length, atomic: options.atomic })
    }));

    return Object.freeze({
      importedCount: writeResult.importedCount,
      failedCount: allFailures.length,
      atomic: options.atomic,
      failures: Object.freeze(allFailures)
    });
  }

  async export(context: PartyImportContext, sink: PartyExportBatchSink, pageSize = 500): Promise<number> {
    await this.authorization.require(authContext(context), partyPermissions.export);
    let page = 1;
    let exported = 0;
    while (true) {
      const result = await this.reader.list({ filter: { companyId: context.companyId }, page: { page, pageSize }, sort: { field: "code", direction: "asc" } });
      if (result.items.length === 0) break;
      const batch = result.items.map((party): PartyExportRow => Object.freeze({
        id: party.id, code: party.code, classification: party.classification, displayName: party.displayName,
        status: party.status, roles: party.roles.join(","), primaryPhone: party.primaryPhone ?? "",
        primaryMobile: party.primaryMobile ?? "", primaryEmail: party.primaryEmail ?? "", updatedAt: party.updatedAt
      }));
      await sink.write(Object.freeze(batch));
      exported += batch.length;
      if (page >= result.totalPages) break;
      page += 1;
    }
    await this.audit.record(Object.freeze({
      action: "party.export", actorId: context.actorId, companyId: context.companyId, partyId: null,
      correlationId: context.correlationId, requestId: context.requestId, occurredAt: context.occurredAt,
      metadata: Object.freeze({ exportedCount: exported, pageSize })
    }));
    return exported;
  }

  private async prepareRow(row: PartyTabularRow, rowNumber: number, mapping: PartyImportColumnMap, context: PartyImportContext): Promise<PreparedRow> {
    try {
      const input = mapRow(row, mapping);
      const previewParty = materializeInput(input, context, `preview-${rowNumber}`);
      const probe = buildProbe(previewParty);
      const [hard, advisory] = await Promise.all([
        this.duplicateLookup.findHardCandidates(probe),
        this.duplicateLookup.findAdvisoryCandidates(probe)
      ]);
      const issues: PartyImportIssue[] = hard.length > 0 ? [Object.freeze({ code: "party.import.hardDuplicate", message: "A Party with the same code or official identifier already exists." })] : [];
      return Object.freeze({
        rowNumber,
        createInput: input,
        previewParty,
        preview: Object.freeze({
          rowNumber, displayName: previewParty.displayName, code: previewParty.code, valid: issues.length === 0,
          issues: Object.freeze(issues), advisoryDuplicatePartyIds: Object.freeze(advisory.map((item) => item.partyId)),
          hardDuplicatePartyIds: Object.freeze(hard.map((item) => item.partyId))
        })
      });
    } catch (error) {
      const issue = Object.freeze({ code: error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "party.import.invalidRow", message: error instanceof Error ? error.message : "Invalid import row." });
      const invalidInput: PartyImportCreateInput = { classification: "natural-person", code: "invalid", firstName: "invalid", lastName: "invalid" };
      return Object.freeze({
        rowNumber,
        createInput: invalidInput,
        previewParty: materializeInput(invalidInput, context, `invalid-${rowNumber}`),
        preview: Object.freeze({ rowNumber, displayName: null, code: readMapped(row, mapping.code) || null, valid: false, issues: Object.freeze([issue]), advisoryDuplicatePartyIds: Object.freeze([]), hardDuplicatePartyIds: Object.freeze([]) })
      });
    }
  }

  private async prepareRows(
    rows: readonly PartyTabularRow[],
    mapping: PartyImportColumnMap,
    context: PartyImportContext
  ): Promise<readonly PreparedRow[]> {
    const preparedRows = await Promise.all(
      rows.map((row, index) => this.prepareRow(row, index + 2, mapping, context))
    );
    const duplicateRowNumbers = findBatchDuplicateRows(preparedRows);

    return preparedRows.map((entry) => duplicateRowNumbers.has(entry.rowNumber)
      ? withIssue(entry, batchDuplicateIssue.code, batchDuplicateIssue.message)
      : entry);
  }

  private async importAtomically(
    rows: readonly PreparedRow[],
    context: PartyImportContext
  ): Promise<{ readonly importedCount: number; readonly failures: readonly PartyImportPreviewRow[] }> {
    let importedCount = 0;

    await this.unitOfWork.run(async ({ parties }) => {
      for (const entry of rows) {
        const party = materialize(entry, context, this.ids.nextId());
        if (await parties.findByCode(context.companyId, party.code)) {
          throw new Error(`party.code.conflict:${party.code}`);
        }
        await parties.add(party);
        importedCount += 1;
      }
    });

    return { importedCount, failures: [] };
  }

  private async importBestEffort(
    rows: readonly PreparedRow[],
    context: PartyImportContext
  ): Promise<{ readonly importedCount: number; readonly failures: readonly PartyImportPreviewRow[] }> {
    let importedCount = 0;
    const failures: PartyImportPreviewRow[] = [];

    for (const entry of rows) {
      try {
        await this.unitOfWork.run(async ({ parties }) => {
          const party = materialize(entry, context, this.ids.nextId());
          if (await parties.findByCode(context.companyId, party.code)) {
            throw new Error("party.code.conflict");
          }
          await parties.add(party);
        });
        importedCount += 1;
      } catch (error) {
        failures.push(withWriteFailure(entry.preview, error));
      }
    }

    return { importedCount, failures };
  }
}

function mapRow(row: PartyTabularRow, mapping: PartyImportColumnMap): PartyImportCreateInput {
  const classification = normalizeClassification(readMapped(row, mapping.classification));
  const code = readMapped(row, mapping.code);
  const roles = parseRoles(readMapped(row, mapping.roles));
  const contacts = [
    contact("phone", readMapped(row, mapping.phone)),
    contact("mobile", readMapped(row, mapping.mobile)),
    contact("email", readMapped(row, mapping.email))
  ].filter((value): value is NonNullable<typeof value> => value !== null);
  const addressLine = readMapped(row, mapping.addressLine);
  const addresses = addressLine
    ? [{
        id: "import-address",
        purpose: "registered" as const,
        addressLine,
        postalCode: nullable(readMapped(row, mapping.postalCode)),
        isPrimary: true
      }]
    : [];

  if (classification === "natural-person") {
    return {
      classification,
      code,
      firstName: readMapped(row, mapping.firstName),
      lastName: readMapped(row, mapping.lastName),
      roles,
      identity: {
        nationalCode: nullable(readMapped(row, mapping.nationalCode)),
        economicNumber: nullable(readMapped(row, mapping.economicNumber)),
        taxFileNumber: nullable(readMapped(row, mapping.taxFileNumber))
      },
      contacts,
      addresses
    };
  }

  return {
    classification,
    code,
    legalName: readMapped(row, mapping.legalName),
    tradeName: nullable(readMapped(row, mapping.tradeName)),
    roles,
    identity: {
      nationalId: nullable(readMapped(row, mapping.nationalId)),
      registrationNumber: nullable(readMapped(row, mapping.registrationNumber)),
      economicNumber: nullable(readMapped(row, mapping.economicNumber)),
      legacyEconomicCode: nullable(readMapped(row, mapping.legacyEconomicCode)),
      taxFileNumber: nullable(readMapped(row, mapping.taxFileNumber))
    },
    contacts,
    addresses
  };
}

function materialize(entry: PreparedRow, context: PartyImportContext, id: string): Party {
  return materializeInput(entry.createInput, context, id);
}

function materializeInput(input: PartyImportCreateInput, context: PartyImportContext, id: string): Party {
  const contacts = (input.contacts ?? []).map((item) => Object.freeze({ ...item, id: `${id}:${item.id}` }));
  const addresses = (input.addresses ?? []).map((item) => Object.freeze({ ...item, id: `${id}:${item.id}` }));
  return input.classification === "natural-person"
    ? createParty({ ...input, contacts, addresses, id, companyId: context.companyId, createdAt: context.occurredAt })
    : createParty({ ...input, contacts, addresses, id, companyId: context.companyId, createdAt: context.occurredAt });
}

function buildProbe(party: Party): PartyDuplicateProbe {
  return Object.freeze({
    companyId: party.companyId,
    excludePartyId: null,
    code: party.code,
    classification: party.classification,
    displayName: party.displayName,
    nationalCode: party.classification === "natural-person" ? party.identity.nationalCode : null,
    nationalId: party.classification === "legal-entity" ? party.identity.nationalId : null,
    economicNumber: party.identity.economicNumber
  });
}

function normalizeClassification(value: string): "natural-person" | "legal-entity" {
  const normalized = value.trim().toLowerCase();
  if (["natural-person", "natural", "individual", "حقیقی"].includes(normalized)) return "natural-person";
  if (["legal-entity", "legal", "company", "حقوقی"].includes(normalized)) return "legal-entity";
  throw new Error("Party classification must identify a natural person or legal entity.");
}

function parseRoles(value: string): readonly PartyRole[] {
  if (!value) return Object.freeze([]);

  const tokens = value
    .split(/[،,;|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const roles: PartyRole[] = [];

  for (const token of tokens) {
    if (["customer", "مشتری"].includes(token)) {
      roles.push("customer");
    } else if (["supplier", "vendor", "تامین کننده", "تأمین‌کننده", "تأمین کننده"].includes(token)) {
      roles.push("supplier");
    } else {
      throw new Error(`Unsupported Party role: ${token}`);
    }
  }

  return Object.freeze([...new Set(roles)]);
}
function contact(type: "phone" | "mobile" | "email", value: string) {
  return value
    ? { id: `import-${type}`, type, value, purpose: "general" as const, isPrimary: true }
    : null;
}

function summarize(rows: readonly PartyImportPreviewRow[]): PartyImportPreview {
  const validRows = rows.filter((row) => row.valid).length;
  return Object.freeze({
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    rows: Object.freeze([...rows])
  });
}

function findBatchDuplicateRows(rows: readonly PreparedRow[]): ReadonlySet<number> {
  const rowNumbersByKey = new Map<string, number[]>();

  for (const row of rows.filter((entry) => entry.preview.valid)) {
    for (const key of duplicateKeys(row.previewParty)) {
      const rowNumbers = rowNumbersByKey.get(key) ?? [];
      rowNumbersByKey.set(key, [...rowNumbers, row.rowNumber]);
    }
  }

  const duplicateRowNumbers = [...rowNumbersByKey.values()]
    .filter((rowNumbers) => rowNumbers.length > 1)
    .flat();
  return new Set(duplicateRowNumbers);
}

function duplicateKeys(party: Party): readonly string[] {
  return [
    `code:${party.code}`,
    party.classification === "natural-person" && party.identity.nationalCode
      ? `nationalCode:${party.identity.nationalCode}`
      : null,
    party.classification === "legal-entity" && party.identity.nationalId
      ? `nationalId:${party.identity.nationalId}`
      : null,
    party.identity.economicNumber ? `economic:${party.identity.economicNumber}` : null
  ].filter((value): value is string => value !== null);
}

function withIssue(entry: PreparedRow, code: string, message: string): PreparedRow {
  const issue = Object.freeze({ code, message });
  return Object.freeze({
    ...entry,
    preview: Object.freeze({
      ...entry.preview,
      valid: false,
      issues: Object.freeze([...entry.preview.issues, issue])
    })
  });
}
function withWriteFailure(preview: PartyImportPreviewRow, error: unknown): PartyImportPreviewRow {
  const issue = Object.freeze({
    code: "party.import.writeFailed",
    message: error instanceof Error ? error.message : "Import write failed."
  });

  return Object.freeze({
    ...preview,
    valid: false,
    issues: Object.freeze([...preview.issues, issue])
  });
}
function readMapped(row: PartyTabularRow, sourceColumn: string | undefined): string {
  return sourceColumn ? String(row[sourceColumn] ?? "").trim() : "";
}

function nullable(value: string): string | null {
  return value.length === 0 ? null : value;
}

function authContext(context: PartyImportContext) {
  return Object.freeze({
    actorId: context.actorId,
    companyId: context.companyId,
    correlationId: context.correlationId,
    requestId: context.requestId
  });
}
