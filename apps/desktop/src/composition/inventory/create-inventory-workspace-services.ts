import {
  INVENTORY_APPLICATION_ERROR_CODES,
  INVENTORY_APPROVAL_REQUEST_TYPE,
  INVENTORY_NUMBER_SERIES_TYPES,
  InventoryApplicationError,
  InventoryApplicationService,
  InventoryDraftService,
  SecuredInventoryService,
  createInventoryLineOperation,
  inventoryPermissions,
  rehydrateInventoryDocument,
  type InventoryApprovalGateway,
  type InventoryAuditSink,
  type InventoryAuthorizationPolicy,
  type InventoryDocumentDetail,
  type InventoryDocumentSnapshot,
  type InventoryDocumentType,
  type InventoryLineOperationSnapshot,
  type InventoryPage,
  type InventoryDocumentListItem,
} from "@argin/inventory";
import {
  SqliteInventoryUnitOfWork,
  SqliteInventoryWorkspaceReader,
  ensureInventoryNumberSeries,
  type InventoryLineLocationTitles,
} from "@argin/inventory-tauri";
import type { DatabaseExecutor } from "@argin/database";
import { SqliteCompanyRepository, SqliteBranchRepository } from "@argin/company-tauri";
import {
  SqliteFiscalPeriodRepository,
  SqliteFiscalUnitOfWork,
  SqliteFiscalYearRepository,
  SqliteHistoricalLockRepository,
} from "@argin/fiscal-tauri";
import { generateDocumentNumber } from "@argin/fiscal";
import { SqliteProductReader, SqliteProductSelectorReader } from "@argin/product-tauri";
import type { ProductDto, ProductSelectorItemDto } from "@argin/product";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import type { WarehouseListItemDto, WarehouseLocationDto, WarehouseZoneDto } from "@argin/warehouse";
import type { AuditServices } from "../audit/create-audit-services";

export interface InventoryDesktopActor {
  readonly id: string;
  readonly displayName: string;
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface InventoryWorkspaceServices {
  readonly can: (permission: string) => boolean;
  list(companyId: string, page: number, search: string): Promise<InventoryPage<InventoryDocumentListItem>>;
  get(companyId: string, documentId: string): Promise<InventoryDocumentDetail | null>;
  getLineLocationTitles(companyId: string, documentId: string): Promise<readonly InventoryLineLocationTitles[]>;
  createDraft(input: {
    companyId: string;
    branchId: string | null;
    fiscalYearId: string;
    fiscalPeriodId: string;
    documentType: InventoryDocumentType;
    businessDate: string;
    description: string | null;
  }): Promise<InventoryDocumentSnapshot>;
  saveDraft(document: InventoryDocumentSnapshot): Promise<InventoryDocumentSnapshot>;
  deleteDraft(document: InventoryDocumentSnapshot): Promise<void>;
  submit(document: InventoryDocumentSnapshot, reason?: string | null): Promise<void>;
  approve(document: InventoryDocumentSnapshot, reason?: string | null): Promise<void>;
  confirm(document: InventoryDocumentSnapshot, reason?: string | null): Promise<void>;
  cancel(document: InventoryDocumentSnapshot, reason?: string | null): Promise<void>;
  reverse(document: InventoryDocumentSnapshot, reason: string): Promise<void>;
  selectProducts(companyId: string, search?: string): Promise<readonly ProductSelectorItemDto[]>;
  getProduct(companyId: string, productId: string): Promise<ProductDto | null>;
  selectWarehouses(companyId: string, branchId: string | null): Promise<readonly WarehouseListItemDto[]>;
  listZones(companyId: string, warehouseId: string): Promise<readonly WarehouseZoneDto[]>;
  listLocations(companyId: string, warehouseId: string, zoneId?: string | null): Promise<readonly WarehouseLocationDto[]>;
  buildOperation(input: {
    companyId: string;
    productId: string;
    enteredQuantity: string;
    unitId: string;
    warehouseId: string;
    zoneId?: string | null;
    locationId?: string | null;
    destinationWarehouseId?: string | null;
    destinationZoneId?: string | null;
    destinationLocationId?: string | null;
  }): Promise<InventoryLineOperationSnapshot>;
}

const fingerprint = (value: unknown): string => JSON.stringify(value);
const requestKey = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();
const approvalId = (companyId: string, documentId: string): string => `inventory-document:${companyId}:${documentId}`;

export function createInventoryWorkspaceServices(input: {
  database: DatabaseExecutor;
  actor: InventoryDesktopActor;
  audit: AuditServices;
}): InventoryWorkspaceServices {
  const { database, actor, audit } = input;
  const uow = new SqliteInventoryUnitOfWork(database);
  const drafts = new InventoryDraftService(uow);
  const reader = new SqliteInventoryWorkspaceReader(database);
  const companies = new SqliteCompanyRepository(database);
  const branches = new SqliteBranchRepository(database);
  const fiscalYears = new SqliteFiscalYearRepository(database);
  const fiscalPeriods = new SqliteFiscalPeriodRepository(database);
  const historicalLocks = new SqliteHistoricalLockRepository(database);
  const warehouseReader = new SqliteWarehouseReader(database);
  const productReader = new SqliteProductReader(database);
  const productSelector = new SqliteProductSelectorReader(database);

  const can = (permission: string): boolean => actor.permissions.includes("system.full-access") || actor.permissions.includes(permission);
  const authorization: InventoryAuthorizationPolicy = {
    async require(context, permission) {
      if (!can(permission)) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
      if (context.branchId !== null && !actor.permissions.includes("system.full-access") && !actor.branchIds.includes(context.branchId)) {
        throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
      }
    },
  };

  const approval: InventoryApprovalGateway = {
    async submit(args) {
      const id = approvalId(args.companyId, args.documentId);
      let request;
      try { request = await audit.getApprovalRequest(id); } catch { request = null; }
      if (!request) {
        request = await audit.createApprovalRequest({
          id,
          requestType: INVENTORY_APPROVAL_REQUEST_TYPE,
          title: `تأیید سند انبار ${args.documentNumber ?? args.documentId}`,
          description: null,
          target: { entityType: "inventory-document", entityId: args.documentId, entityDisplayName: args.documentNumber },
          scope: { companyId: args.companyId, branchId: args.branchId, fiscalYearId: null },
          createdBy: { type: "user", id: args.actorId, displayName: args.actorDisplayName },
          createdAt: now(),
          correlationId: args.correlationId,
        });
      }
      if (request.status === "draft") {
        request = await audit.submitApprovalRequest({
          approvalRequestId: id,
          actor: { type: "user", id: args.actorId, displayName: args.actorDisplayName },
          correlationId: args.correlationId,
        });
      }
      return { requestId: request.id, status: request.status };
    },
    async approve(args) {
      const id = approvalId(args.companyId, args.documentId);
      const request = await audit.approveApprovalRequest({
        approvalRequestId: id,
        actor: { type: "user", id: args.actorId, displayName: args.actorDisplayName },
        comment: args.comment,
        correlationId: args.correlationId,
      });
      return { requestId: request.id, status: request.status };
    },
    async requireApproved(companyId, documentId) {
      const request = await audit.getApprovalRequest(approvalId(companyId, documentId));
      if (request.scope.companyId !== companyId || request.target.entityId !== documentId || request.status !== "approved") {
        throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.invalidRequest, "approval");
      }
    },
  };

  const auditSink: InventoryAuditSink = {
    async record(event) {
      const action = event.action.endsWith("submit") ? "submit"
        : event.action.endsWith("approve") ? "approve"
        : event.action.endsWith("cancel") ? "cancel"
        : "status-change";
      try {
        await audit.recordAuditEntry({
          id: `inventory:${event.action}:${event.requestId}:${event.documentId}`,
          occurredAt: event.occurredAt,
          action,
          outcome: "success",
          source: "desktop",
          actor: { type: "user", id: event.actorId, displayName: actor.displayName },
          scope: { companyId: event.companyId, branchId: event.branchId, fiscalYearId: null },
          target: { entityType: "inventory-document", entityId: event.documentId, entityDisplayName: null },
          reason: event.reason,
          before: event.beforeStatus ? { status: event.beforeStatus } : null,
          after: event.afterStatus ? { status: event.afterStatus } : null,
          correlationId: event.correlationId,
          metadata: { requestId: event.requestId, inventoryAction: event.action, ...event.metadata },
        });
      } catch (error) {
        if (!(error instanceof Error) || !/already|duplicate|unique/i.test(error.message)) throw error;
      }
    },
  };

  const scopeReaders = { companies, branches, fiscalYears, fiscalPeriods, historicalLocks, warehouses: warehouseReader };
  const application = new InventoryApplicationService({
    uow,
    scopeReaders,
    scopeContext: (companyId) => ({
      companyId,
      actor: { id: actor.id, branchIds: [...actor.branchIds], permissions: [...actor.permissions] },
      allowCrossBranchTransfers: true,
    }),
    masters: {
      product: (companyId, productId) => productReader.getById({ companyId, productId }),
      async warehouse(companyId, reference) {
        const warehouse = await warehouseReader.getById({ companyId, warehouseId: reference.warehouseId });
        const zones = reference.zoneId ? await warehouseReader.listZones({ companyId, warehouseId: reference.warehouseId }) : [];
        const locations = reference.locationId ? await warehouseReader.listLocations({ companyId, warehouseId: reference.warehouseId, zoneId: reference.zoneId ?? undefined }) : [];
        return {
          warehouse,
          zone: reference.zoneId ? zones.find((item) => item.zoneId === reference.zoneId) ?? null : null,
          location: reference.locationId ? locations.find((item) => item.locationId === reference.locationId) ?? null : null,
        };
      },
    },
    identities: {
      movementId: () => crypto.randomUUID(),
      transferId: () => crypto.randomUUID(),
    },
    numbering: {
      async assign(document, context) {
        if (!document.scope) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.invalidRequest, "scope");
        const fiscalUow = SqliteFiscalUnitOfWork.fromSession(uow.sessionFor(context));
        await ensureInventoryNumberSeries(uow.sessionFor(context), document.companyId, document.documentType);
        const number = await generateDocumentNumber(fiscalUow, {
          companyId: document.companyId,
          branchId: document.scope.branchId,
          fiscalYearId: document.scope.fiscalYearId,
          entityType: INVENTORY_NUMBER_SERIES_TYPES[document.documentType],
        });
        return rehydrateInventoryDocument({ ...document, documentNumber: number });
      },
    },
  });
  const secured = new SecuredInventoryService({
    application,
    documents: { findById: (companyId, documentId) => uow.execute((ctx) => ctx.documents.findById(companyId, documentId)) },
    authorization,
    approval,
    audit: auditSink,
  });

  const security = { actorId: actor.id, actorDisplayName: actor.displayName };
  const life = (document: InventoryDocumentSnapshot, reason?: string | null) => ({
    companyId: document.companyId,
    documentId: document.documentId,
    requestKey: requestKey(),
    payloadFingerprint: fingerprint([document.documentId, document.version, reason ?? null]),
    expectedVersion: document.version,
    action: { actorUserId: actor.id, occurredAt: now(), reason: reason ?? null },
  });

  const resolveWarehouse = async (companyId: string, warehouseId: string, zoneId?: string | null, locationId?: string | null) => {
    const warehouse = await warehouseReader.getById({ companyId, warehouseId });
    const zones = zoneId ? await warehouseReader.listZones({ companyId, warehouseId }) : [];
    const locations = locationId ? await warehouseReader.listLocations({ companyId, warehouseId, zoneId: zoneId ?? undefined }) : [];
    return { warehouse, zone: zoneId ? zones.find((item) => item.zoneId === zoneId) ?? null : null, location: locationId ? locations.find((item) => item.locationId === locationId) ?? null : null };
  };

  return {
    can,
    list: (companyId, page, search) => reader.listDocuments({ filter: { companyId, search: search || null }, page: { page, pageSize: 50 }, sort: { field: "businessDate", direction: "desc" } }),
    get: (companyId, documentId) => reader.getDocument(companyId, documentId),
    getLineLocationTitles: (companyId, documentId) => reader.getLineLocationTitles(companyId, documentId),
    async createDraft(args) {
      if (!can(inventoryPermissions.create)) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
      if (args.branchId !== null && !actor.permissions.includes("system.full-access") && !actor.branchIds.includes(args.branchId)) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
      const createdAt = now();
      const key = requestKey();
      const result = await drafts.create({
        companyId: args.companyId,
        requestKey: key,
        payloadFingerprint: fingerprint(args),
        document: {
          documentId: crypto.randomUUID(), companyId: args.companyId, documentType: args.documentType,
          businessDate: args.businessDate, description: args.description, createdAt,
          scope: { branchId: args.branchId, destinationBranchId: null, fiscalYearId: args.fiscalYearId, fiscalPeriodId: args.fiscalPeriodId },
          lines: [],
        },
      });
      return result.document;
    },
    async saveDraft(document) {
      if (!can(inventoryPermissions.edit)) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
      const requested = rehydrateInventoryDocument({ ...document, updatedAt: now() });
      const result = await drafts.save({
        companyId: requested.companyId,
        requestKey: requestKey(),
        payloadFingerprint: fingerprint(requested),
        expectedVersion: document.version,
        document: requested,
      });
      return result.document;
    },
    async deleteDraft(document) {
      if (!can(inventoryPermissions.edit)) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
      await drafts.delete({ companyId: document.companyId, documentId: document.documentId, requestKey: requestKey(), payloadFingerprint: fingerprint([document.documentId, document.version]), expectedVersion: document.version, deletedAt: now() });
    },
    async submit(document, reason) {
      if (document.status !== "submitted") {
        await secured.submit(security, life(document, reason));
        return;
      }
      // Inventory may have committed before the shared Approval service failed.
      const current = (await reader.getDocument(document.companyId, document.documentId))?.document;
      if (!current) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.notFound);
      const requestId = requestKey();
      await authorization.require({
        actorId: actor.id,
        companyId: current.companyId,
        branchId: current.scope?.branchId ?? null,
        requestId,
        correlationId: requestId,
      }, inventoryPermissions.submit);
      if (current.status !== "submitted" || current.version !== document.version) {
        throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.concurrencyConflict);
      }
      await approval.submit({
        companyId: current.companyId,
        branchId: current.scope?.branchId ?? null,
        documentId: current.documentId,
        documentNumber: current.documentNumber,
        actorId: actor.id,
        actorDisplayName: actor.displayName,
        correlationId: requestId,
      });
    },
    async approve(document, reason) { await secured.approve(security, life(document, reason)); },
    async confirm(document, reason) { await secured.confirm(security, { ...life(document, reason), allowNegativeStock: false }); },
    async cancel(document, reason) { await secured.cancel(security, life(document, reason)); },
    async reverse(document, reason) {
      if (!document.scope) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.invalidRequest, "scope");
      const base = life(document, reason);
      await secured.reverse(security, {
        ...base,
        businessDate: new Date().toISOString().slice(0, 10),
        reversalScope: document.scope,
        action: { ...base.action, reversalDocumentId: crypto.randomUUID() },
      });
    },
    selectProducts: (companyId, search) => productSelector.select({ companyId, search: search ?? null, kinds: ["product"], statuses: ["active"], stockTracking: true, limit: 50 }),
    getProduct: (companyId, productId) => productReader.getById({ companyId, productId }),
    selectWarehouses: (companyId, branchId) => warehouseReader.select({ companyId, branchId: branchId ?? undefined, includeCompanyWide: true, statuses: ["active"], limit: 100 }),
    listZones: (companyId, warehouseId) => warehouseReader.listZones({ companyId, warehouseId, statuses: ["active"] }),
    listLocations: (companyId, warehouseId, zoneId) => warehouseReader.listLocations({ companyId, warehouseId, zoneId: zoneId ?? undefined, statuses: ["active"] }),
    async buildOperation(args) {
      const product = await productReader.getById({ companyId: args.companyId, productId: args.productId });
      const source = { warehouseId: args.warehouseId, zoneId: args.zoneId ?? null, locationId: args.locationId ?? null };
      const destination = args.destinationWarehouseId ? { warehouseId: args.destinationWarehouseId, zoneId: args.destinationZoneId ?? null, locationId: args.destinationLocationId ?? null } : null;
      return createInventoryLineOperation({
        companyId: args.companyId,
        productId: args.productId,
        product,
        enteredQuantity: args.enteredQuantity,
        unitId: args.unitId,
        warehouse: source,
        resolvedWarehouse: await resolveWarehouse(args.companyId, source.warehouseId, source.zoneId, source.locationId),
        destination,
        resolvedDestination: destination ? await resolveWarehouse(args.companyId, destination.warehouseId, destination.zoneId, destination.locationId) : null,
      });
    },
  };
}
