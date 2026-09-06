import { createWarehouse } from "../domain/warehouse.ts";
import {
  activateWarehouse,
  archiveWarehouse,
  classifyWarehouse,
  deactivateWarehouse,
  type ClassifiedWarehouseSnapshot,
  type WarehouseKind,
  type WarehouseStatus,
} from "../domain/warehouse-lifecycle.ts";
import {
  assignWarehouseOrganizationalScope,
  type OrganizedWarehouseSnapshot,
  type WarehouseOrganizationalScope,
} from "../domain/warehouse-organization.ts";
import {
  createWarehouseIdentifierSnapshot,
  normalizeWarehouseCode,
  normalizeWarehouseExternalIdentifier,
  type WarehouseExternalIdentifier,
} from "../domain/warehouse-identifiers.ts";
import type { WarehouseDto, WarehousePageDto } from "./contracts/warehouse-dto.ts";
import type { WarehousePersistenceState, WarehouseRepository } from "./contracts/warehouse-repository.ts";
import type { WarehouseUnitOfWork } from "./contracts/warehouse-unit-of-work.ts";
import type { WarehouseBranchResolver } from "./contracts/warehouse-validation.ts";
import type { WarehouseAuditSink, WarehouseAuthorizationPolicy } from "./contracts/warehouse-security.ts";
import { warehousePermissions } from "./contracts/warehouse-security.ts";
import { WarehouseService } from "./warehouse-service.ts";

export const warehouseImportFields = [
  "code",
  "title",
  "description",
  "kind",
  "status",
  "scopeMode",
  "branchId",
  "externalIdentifiers",
] as const;

export type WarehouseImportField = (typeof warehouseImportFields)[number];
export type WarehouseImportColumnMap = Readonly<Partial<Record<WarehouseImportField, string>>>;
export type WarehouseTabularRow = Readonly<Record<string, string | null | undefined>>;

export interface WarehouseBulkContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface WarehouseImportIssue {
  readonly code: string;
  readonly message: string;
}

export interface WarehouseImportPreviewRow {
  readonly rowNumber: number;
  readonly code: string | null;
  readonly title: string | null;
  readonly kind: WarehouseKind | null;
  readonly valid: boolean;
  readonly issues: readonly WarehouseImportIssue[];
}

export interface WarehouseImportPreview {
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly rows: readonly WarehouseImportPreviewRow[];
}

export interface WarehouseImportResult {
  readonly importedCount: number;
  readonly failedCount: number;
  readonly atomic: boolean;
  readonly failures: readonly WarehouseImportPreviewRow[];
}

export interface WarehouseImportIdGenerator { nextId(): string; }

export interface WarehouseExportRow {
  readonly warehouseId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly kind: string;
  readonly status: string;
  readonly scopeMode: string;
  readonly branchId: string;
  readonly externalIdentifiers: string;
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WarehouseExportBatchSink { write(rows: readonly WarehouseExportRow[]): Promise<void>; }
export interface WarehouseBulkExportReader {
  readPage(companyId: string, page: number, pageSize: number): Promise<WarehousePageDto<WarehouseDto>>;
}

interface PreparedRow {
  readonly rowNumber: number;
  readonly state: WarehousePersistenceState | null;
  readonly preview: WarehouseImportPreviewRow;
}

const MAX_PAGE_SIZE = 200;

export class WarehouseBulkTransferService {
  constructor(
    private readonly unitOfWork: WarehouseUnitOfWork,
    private readonly branches: WarehouseBranchResolver,
    private readonly exportReader: WarehouseBulkExportReader,
    private readonly authorization: WarehouseAuthorizationPolicy,
    private readonly audit: WarehouseAuditSink,
    private readonly ids: WarehouseImportIdGenerator,
  ) {}

  async previewImport(rows: readonly WarehouseTabularRow[], mapping: WarehouseImportColumnMap, context: WarehouseBulkContext): Promise<WarehouseImportPreview> {
    await this.authorization.require(authContext(context), warehousePermissions.import);
    return summarize(await this.prepareRows(rows, mapping, context));
  }

  async import(rows: readonly WarehouseTabularRow[], mapping: WarehouseImportColumnMap, context: WarehouseBulkContext, options: { readonly atomic: boolean }): Promise<WarehouseImportResult> {
    await this.authorization.require(authContext(context), warehousePermissions.import);
    const prepared = await this.prepareRows(rows, mapping, context);
    const invalid = prepared.filter((entry) => !entry.preview.valid).map((entry) => entry.preview);
    if (options.atomic && invalid.length > 0) return Object.freeze({ importedCount: 0, failedCount: invalid.length, atomic: true, failures: Object.freeze(invalid) });

    const valid = prepared.filter((entry): entry is PreparedRow & { state: WarehousePersistenceState } => entry.preview.valid && entry.state !== null);
    const failures: WarehouseImportPreviewRow[] = [...invalid];
    let importedCount = 0;

    if (options.atomic) {
      await this.unitOfWork.execute(async ({ warehouses }) => {
        for (const entry of valid) {
          const state = replaceWarehouseId(entry.state, this.ids.nextId());
          await assertRepositoryAvailability(warehouses, state);
          await warehouses.add(state);
          importedCount += 1;
        }
      });
    } else {
      for (const entry of valid) {
        try {
          await this.unitOfWork.execute(async ({ warehouses }) => {
            const state = replaceWarehouseId(entry.state, this.ids.nextId());
            await assertRepositoryAvailability(warehouses, state);
            await warehouses.add(state);
          });
          importedCount += 1;
        } catch (error) {
          failures.push(withWriteFailure(entry.preview, error));
        }
      }
    }

    if (importedCount > 0) {
      await this.audit.record(Object.freeze({
        action: "warehouse.import", actorId: context.actorId, companyId: context.companyId,
        warehouseId: "*", childEntityId: null, correlationId: context.correlationId,
        requestId: context.requestId, occurredAt: context.occurredAt,
        metadata: Object.freeze({ importedCount, failedCount: failures.length, atomic: options.atomic }),
      }));
    }
    return Object.freeze({ importedCount, failedCount: failures.length, atomic: options.atomic, failures: Object.freeze(failures) });
  }

  async export(context: WarehouseBulkContext, sink: WarehouseExportBatchSink, pageSize = MAX_PAGE_SIZE): Promise<number> {
    await this.authorization.require(authContext(context), warehousePermissions.export);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw new Error("warehouse.export.page-size-invalid");
    let page = 1;
    let exportedCount = 0;
    while (true) {
      const result = await this.exportReader.readPage(context.companyId, page, pageSize);
      if (result.items.length === 0) break;
      const batch = Object.freeze(result.items.map(toExportRow));
      await sink.write(batch);
      exportedCount += batch.length;
      if (exportedCount >= result.totalCount || result.items.length < pageSize) break;
      page += 1;
    }
    await this.audit.record(Object.freeze({
      action: "warehouse.export", actorId: context.actorId, companyId: context.companyId,
      warehouseId: "*", childEntityId: null, correlationId: context.correlationId,
      requestId: context.requestId, occurredAt: context.occurredAt,
      metadata: Object.freeze({ exportedCount, pageSize }),
    }));
    return exportedCount;
  }

  private async prepareRows(rows: readonly WarehouseTabularRow[], mapping: WarehouseImportColumnMap, context: WarehouseBulkContext): Promise<readonly PreparedRow[]> {
    const prepared: PreparedRow[] = [];
    for (let index = 0; index < rows.length; index += 1) prepared.push(await this.prepareRow(rows[index]!, index + 2, mapping, context));
    const duplicateRows = new Set<number>();
    const codeOwner = new Map<string, number>();
    const externalOwner = new Map<string, number>();
    for (const entry of prepared) {
      if (!entry.state) continue;
      const codeKey = normalizeWarehouseCode(entry.state.warehouse.code);
      const priorCode = codeOwner.get(codeKey);
      if (priorCode !== undefined) { duplicateRows.add(priorCode); duplicateRows.add(entry.rowNumber); } else codeOwner.set(codeKey, entry.rowNumber);
      for (const identifier of entry.state.externalIdentifiers) {
        const key = `${identifier.namespace}\u0000${identifier.value}`;
        const prior = externalOwner.get(key);
        if (prior !== undefined) { duplicateRows.add(prior); duplicateRows.add(entry.rowNumber); } else externalOwner.set(key, entry.rowNumber);
      }
    }
    return Object.freeze(prepared.map((entry) => duplicateRows.has(entry.rowNumber)
      ? withIssue(entry, "warehouse.import.batch-duplicate", "Duplicate Warehouse code or external identifier exists in the import batch.")
      : entry));
  }

  private async prepareRow(row: WarehouseTabularRow, rowNumber: number, mapping: WarehouseImportColumnMap, context: WarehouseBulkContext): Promise<PreparedRow> {
    try {
      const state = await mapRowToState(row, mapping, context, `preview-warehouse-${rowNumber}`, this.branches);
      const duplicate = await this.unitOfWork.execute(async ({ warehouses }) => {
        try { await assertRepositoryAvailability(warehouses, state); return false; } catch { return true; }
      });
      const issues = duplicate ? [Object.freeze({ code: "warehouse.import.hard-duplicate", message: "Warehouse code or external identifier already exists in the company scope." })] : [];
      return Object.freeze({ rowNumber, state, preview: Object.freeze({ rowNumber, code: state.warehouse.code, title: state.warehouse.title, kind: state.warehouse.kind, valid: issues.length === 0, issues: Object.freeze(issues) }) });
    } catch (error) {
      return Object.freeze({ rowNumber, state: null, preview: Object.freeze({ rowNumber, code: nullable(readMapped(row, mapping.code)), title: nullable(readMapped(row, mapping.title)), kind: null, valid: false, issues: Object.freeze([{ code: "warehouse.import.invalid-row", message: error instanceof Error ? error.message : "Invalid Warehouse import row." }]) }) });
    }
  }
}

export const defaultInitialWarehouse = Object.freeze({
  code: "MAIN", title: "انبار اصلی", kind: "general" as WarehouseKind,
  organizationalScope: Object.freeze({ mode: "company" as const }),
});

export class WarehouseInitialSetupService {
  constructor(
    private readonly service: WarehouseService,
    private readonly authorization: WarehouseAuthorizationPolicy,
    private readonly audit: WarehouseAuditSink,
    private readonly ids: WarehouseImportIdGenerator,
  ) {}

  async ensureDefault(context: WarehouseBulkContext, overrides: Partial<{ code: string; title: string; description: string | null }> = {}): Promise<{ readonly created: boolean; readonly warehouse: WarehouseDto | null }> {
    await this.authorization.require(authContext(context), warehousePermissions.create);
    const existing = await this.service.list({ filter: { companyId: context.companyId }, page: { page: 1, pageSize: 1 }, sort: { field: "code", direction: "asc" } });
    if (existing.totalCount > 0) return Object.freeze({ created: false, warehouse: null });
    const warehouse = await this.service.create({
      requestId: context.requestId, warehouseId: this.ids.nextId(), companyId: context.companyId,
      code: overrides.code ?? defaultInitialWarehouse.code, title: overrides.title ?? defaultInitialWarehouse.title,
      description: overrides.description ?? null, kind: defaultInitialWarehouse.kind,
      organizationalScope: defaultInitialWarehouse.organizationalScope, externalIdentifiers: [], occurredAt: context.occurredAt,
    });
    await this.audit.record(Object.freeze({
      action: "warehouse.initial-setup", actorId: context.actorId, companyId: context.companyId,
      warehouseId: warehouse.warehouseId, childEntityId: null, correlationId: context.correlationId,
      requestId: context.requestId, occurredAt: context.occurredAt,
      metadata: Object.freeze({ code: warehouse.code, title: warehouse.title }),
    }));
    return Object.freeze({ created: true, warehouse });
  }
}

async function mapRowToState(row: WarehouseTabularRow, mapping: WarehouseImportColumnMap, context: WarehouseBulkContext, warehouseId: string, branches: WarehouseBranchResolver): Promise<WarehousePersistenceState> {
  const kind = parseKind(readMapped(row, mapping.kind));
  const status = parseStatus(readMapped(row, mapping.status));
  const scope = parseScope(row, mapping);
  const base = createWarehouse({ warehouseId, companyId: context.companyId, code: readMapped(row, mapping.code), title: readMapped(row, mapping.title), description: nullable(readMapped(row, mapping.description)), createdAt: context.occurredAt });
  const classified = classifyWarehouse({ warehouse: base, kind });
  const withStatus: ClassifiedWarehouseSnapshot = status === "active" ? activateWarehouse(classified, context.occurredAt) : status === "inactive" ? deactivateWarehouse(classified, context.occurredAt) : archiveWarehouse(classified, context.occurredAt);
  let organized: OrganizedWarehouseSnapshot;
  if (scope.mode === "branch") {
    const branch = await branches.findById(context.companyId, scope.branchId);
    if (!branch) throw new Error("warehouse.import.branch-not-found");
    organized = assignWarehouseOrganizationalScope({ warehouse: withStatus, scope, branch });
  } else organized = assignWarehouseOrganizationalScope({ warehouse: withStatus, scope });
  const identifiers = createWarehouseIdentifierSnapshot(organized, parseExternalIdentifiers(readMapped(row, mapping.externalIdentifiers)));
  return Object.freeze({ warehouse: organized, externalIdentifiers: identifiers.externalIdentifiers, version: 1 });
}

async function assertRepositoryAvailability(repository: WarehouseRepository, state: WarehousePersistenceState): Promise<void> {
  if (await repository.findByCode(state.warehouse.companyId, state.warehouse.code)) throw new Error("warehouse.import.duplicate-code");
  for (const identifier of state.externalIdentifiers) if (await repository.findByExternalIdentifier(state.warehouse.companyId, identifier.namespace, identifier.value)) throw new Error("warehouse.import.duplicate-external-identifier");
}

function replaceWarehouseId(state: WarehousePersistenceState, warehouseId: string): WarehousePersistenceState { return Object.freeze({ ...state, warehouse: Object.freeze({ ...state.warehouse, warehouseId }) }); }
function parseKind(value: string): WarehouseKind {
  const normalized = value.trim().toLowerCase();
  const allowed: readonly WarehouseKind[] = ["general", "raw-material", "finished-goods", "consumables", "spare-parts", "wip", "transit", "consignment", "other"];
  if (!allowed.includes(normalized as WarehouseKind)) throw new Error("warehouse.import.kind-invalid");
  return normalized as WarehouseKind;
}
function parseStatus(value: string): WarehouseStatus {
  const normalized = (value.trim() || "active").toLowerCase();
  if (normalized !== "active" && normalized !== "inactive" && normalized !== "archived") throw new Error("warehouse.import.status-invalid");
  return normalized;
}
function parseScope(row: WarehouseTabularRow, mapping: WarehouseImportColumnMap): WarehouseOrganizationalScope {
  const mode = (readMapped(row, mapping.scopeMode).trim() || "company").toLowerCase();
  if (mode === "company") return Object.freeze({ mode: "company" });
  if (mode === "branch") {
    const branchId = readMapped(row, mapping.branchId).trim();
    if (!branchId) throw new Error("warehouse.import.branch-required");
    return Object.freeze({ mode: "branch", branchId });
  }
  throw new Error("warehouse.import.scope-invalid");
}
function parseExternalIdentifiers(value: string): readonly WarehouseExternalIdentifier[] {
  if (!value.trim()) return Object.freeze([]);
  return Object.freeze(value.split("|").map((part) => {
    const separator = part.indexOf("=");
    if (separator <= 0) throw new Error("warehouse.import.external-identifier-invalid");
    return normalizeWarehouseExternalIdentifier({ namespace: part.slice(0, separator), value: part.slice(separator + 1) });
  }));
}
function readMapped(row: WarehouseTabularRow, column: string | undefined): string { return column ? row[column]?.trim() ?? "" : ""; }
function nullable(value: string): string | null { return value.trim() ? value.trim() : null; }
function authContext(context: WarehouseBulkContext) { return { actorId: context.actorId, companyId: context.companyId, correlationId: context.correlationId, requestId: context.requestId }; }
function summarize(rows: readonly PreparedRow[]): WarehouseImportPreview {
  const previewRows = Object.freeze(rows.map((row) => row.preview));
  const validRows = previewRows.filter((row) => row.valid).length;
  return Object.freeze({ totalRows: previewRows.length, validRows, invalidRows: previewRows.length - validRows, rows: previewRows });
}
function withIssue(entry: PreparedRow, code: string, message: string): PreparedRow { return Object.freeze({ ...entry, preview: Object.freeze({ ...entry.preview, valid: false, issues: Object.freeze([...entry.preview.issues, Object.freeze({ code, message })]) }) }); }
function withWriteFailure(preview: WarehouseImportPreviewRow, error: unknown): WarehouseImportPreviewRow { return Object.freeze({ ...preview, valid: false, issues: Object.freeze([...preview.issues, Object.freeze({ code: "warehouse.import.write-failed", message: error instanceof Error ? error.message : "Warehouse write failed." })]) }); }
function toExportRow(item: WarehouseDto): WarehouseExportRow {
  return Object.freeze({ warehouseId: item.warehouseId, code: item.code, title: item.title, description: item.description ?? "", kind: item.kind, status: item.status, scopeMode: item.organizationalScope.mode, branchId: item.organizationalScope.mode === "branch" ? item.organizationalScope.branchId : "", externalIdentifiers: item.externalIdentifiers.map((entry) => `${entry.namespace}=${entry.value}`).join("|"), version: String(item.version), createdAt: item.createdAt, updatedAt: item.updatedAt });
}
