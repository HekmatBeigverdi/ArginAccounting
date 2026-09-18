import type { DatabaseExecutor } from "@argin/database";
import { generateDocumentNumber, validateOperationDate } from "@argin/fiscal";
import {
  SqliteFiscalPeriodRepository,
  SqliteFiscalUnitOfWork,
  SqliteFiscalYearRepository,
  SqliteHistoricalLockRepository,
} from "@argin/fiscal-tauri";
import {
  InventoryDraftService,
  createInventoryDocumentLine,
  createInventoryLineOperation,
  type InventorySourceDocumentPort,
} from "@argin/inventory";
import { SqliteInventoryUnitOfWork } from "@argin/inventory-tauri";
import { SqlitePartyReader } from "@argin/party-tauri";
import type { PartyDetailDto, PartySelectorDto } from "@argin/party";
import {
  PurchaseApplicationError,
  SecuredPurchaseService,
  calculatePurchaseDocumentTotals,
  calculatePurchaseLineTotals,
  createPurchaseApplicationServices,
  createPurchaseCommercialTerms,
  createPurchaseItemSnapshot,
  createPurchaseSupplierSnapshot,
  type PurchaseCommercialFactSnapshot,
  type PurchaseDocumentSnapshot,
  type PurchaseDocumentType,
  type PurchaseLineTotals,
  type PurchasePermission,
} from "@argin/purchase";
import { SqlitePurchaseUnitOfWork } from "@argin/purchase-tauri";
import { SqliteProductReader, SqliteProductSelectorReader } from "@argin/product-tauri";
import type { ProductDto, ProductSelectorItemDto } from "@argin/product";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import type { WarehouseListItemDto } from "@argin/warehouse";
import type { AuditServices } from "../audit/create-audit-services";

export interface PurchaseDesktopActor {
  readonly id: string;
  readonly displayName: string;
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface PurchaseWorkspaceLineInput {
  readonly productId: string;
  readonly quantity: string;
  readonly unitId: string;
  readonly unitPrice: number;
  readonly discountRateBasisPoints: number;
  readonly chargeAmount: number;
  readonly description: string | null;
}

export interface PurchaseWorkspaceDetail {
  readonly document: PurchaseDocumentSnapshot;
  readonly commercialFacts: readonly PurchaseCommercialFactSnapshot[];
  readonly lineTotals: Readonly<Record<string, PurchaseLineTotals>>;
  readonly totals: ReturnType<typeof calculatePurchaseDocumentTotals>;
}

export interface PurchaseWorkspaceServices {
  readonly can: (permission: PurchasePermission | string) => boolean;
  list(companyId: string, branchId: string, search: string): Promise<readonly PurchaseDocumentSnapshot[]>;
  get(companyId: string, documentId: string): Promise<PurchaseWorkspaceDetail | null>;
  selectSuppliers(companyId: string, search?: string): Promise<readonly PartySelectorDto[]>;
  selectItems(companyId: string, search?: string): Promise<readonly ProductSelectorItemDto[]>;
  getItem(companyId: string, productId: string): Promise<ProductDto | null>;
  selectWarehouses(companyId: string, branchId: string): Promise<readonly WarehouseListItemDto[]>;
  create(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly fiscalYearId: string;
    readonly supplierId: string;
    readonly documentType: PurchaseDocumentType;
    readonly businessDate: string;
    readonly description: string | null;
    readonly lines: readonly PurchaseWorkspaceLineInput[];
  }): Promise<PurchaseDocumentSnapshot>;
  submit(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  approve(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  confirm(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  cancel(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  reopen(document: PurchaseDocumentSnapshot, reason: string): Promise<PurchaseDocumentSnapshot>;
  stageInventoryReceipt(document: PurchaseDocumentSnapshot, warehouseId: string): Promise<{ inventoryDocumentId: string; status: string; version: number }>;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const fingerprint = (value: unknown) => JSON.stringify(value);

function prefix(type: PurchaseDocumentType): string {
  if (type === "purchase-order") return "PO-";
  if (type === "supplier-invoice") return "PI-";
  if (type === "purchase-return") return "PR-";
  return "PC-";
}

const approvalId = (companyId: string, documentId: string, cycle: string) =>
  "purchase-document:" + companyId + ":" + documentId + ":" + cycle;

function latestSubmitCycle(document: PurchaseDocumentSnapshot): string {
  for (let index = document.lifecycleHistory.length - 1; index >= 0; index -= 1) {
    const item = document.lifecycleHistory[index];
    if (item?.toStatus === "submitted") return item.occurredAt;
  }
  throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "approvalCycle");
}

function supplierSnapshot(detail: PartyDetailDto) {
  return createPurchaseSupplierSnapshot({
    companyId: detail.companyId,
    supplierId: detail.id,
    code: detail.code,
    displayName: detail.displayName,
    classification: detail.classification,
    nationalCode: detail.identity.nationalCode,
    nationalId: detail.identity.nationalId,
    economicNumber: detail.identity.economicNumber,
    taxFileNumber: detail.identity.taxFileNumber,
  });
}

function itemSnapshot(product: ProductDto) {
  const unitId = product.masterData.commercial.defaultPurchaseUnitId ?? product.units?.baseUnitId ?? null;
  const unit = unitId ? product.units?.units.find(value => value.unitId === unitId) ?? null : null;
  return createPurchaseItemSnapshot({
    itemId: product.productId,
    itemType: product.kind,
    code: product.code,
    displayName: product.title,
    sku: product.identifiers.sku,
    referenceCode: product.identifiers.referenceCode,
    taxpayerGoodsServiceId: product.identifiers.taxpayerGoodsServiceId,
    purchaseDescription: product.masterData.commercial.purchaseDescription,
    brand: product.masterData.commercial.brand,
    model: product.masterData.commercial.model,
    stockTracking: product.masterData.operational.stockTracking,
    taxTreatment: product.masterData.tax.treatment,
    vatRateBasisPoints: product.masterData.tax.vatRateBasisPoints,
    defaultPurchaseUnit: unit ? {
      unitId: unit.unitId,
      code: unit.code,
      title: unit.title,
      taxpayerUnitCode: unit.taxpayerUnitCode ?? null,
    } : null,
  });
}

function termsFor(product: ProductDto, line: PurchaseWorkspaceLineInput) {
  if (!product.units) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "unitId");
  const entered = product.units.units.find(unit => unit.unitId === line.unitId);
  const base = product.units.units.find(unit => unit.unitId === product.units!.baseUnitId);
  if (!entered || !base) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "unitId");
  return createPurchaseCommercialTerms({
    enteredQuantity: line.quantity,
    enteredUnit: {
      unitId: entered.unitId, code: entered.code, title: entered.title,
      ratioToBase: String(entered.ratioToBase), precision: entered.precision,
      roundingMode: entered.roundingMode, taxpayerUnitCode: entered.taxpayerUnitCode ?? null,
    },
    baseUnit: {
      unitId: base.unitId, code: base.code, title: base.title,
      ratioToBase: String(base.ratioToBase), precision: base.precision,
      roundingMode: base.roundingMode, taxpayerUnitCode: base.taxpayerUnitCode ?? null,
    },
    unitPrice: { amount: line.unitPrice, currency: "IRR" },
    discounts: line.discountRateBasisPoints > 0 ? [{ kind: "percentage", rateBasisPoints: line.discountRateBasisPoints }] : [],
    charges: line.chargeAmount > 0 ? [{ kind: "fixed", amount: { amount: line.chargeAmount, currency: "IRR" } }] : [],
    tax: {
      treatment: product.masterData.tax.treatment,
      rateBasisPoints: product.masterData.tax.vatRateBasisPoints,
    },
  });
}

export function createPurchaseWorkspaceServices(input: {
  readonly database: DatabaseExecutor;
  readonly actor: PurchaseDesktopActor;
  readonly audit: AuditServices;
}): PurchaseWorkspaceServices {
  const { database, actor, audit } = input;
  const uow = new SqlitePurchaseUnitOfWork(database);
  const inventoryUow = new SqliteInventoryUnitOfWork(database);
  const inventoryDrafts = new InventoryDraftService(inventoryUow);
  const parties = new SqlitePartyReader(database);
  const products = new SqliteProductReader(database);
  const productSelector = new SqliteProductSelectorReader(database);
  const warehouses = new SqliteWarehouseReader(database);
  const fiscalYears = new SqliteFiscalYearRepository(database);
  const fiscalPeriods = new SqliteFiscalPeriodRepository(database);
  const locks = new SqliteHistoricalLockRepository(database);
  const fiscalUow = new SqliteFiscalUnitOfWork(database);

  const can = (permission: PurchasePermission | string) =>
    actor.permissions.includes("system.full-access") || actor.permissions.includes(permission);

  const authorization = {
    async require(context: { branchId: string }, permission: PurchasePermission) {
      if (!can(permission) || (!actor.permissions.includes("system.full-access") && !actor.branchIds.includes(context.branchId))) {
        throw new PurchaseApplicationError("PURCHASE_APP_UNAUTHORIZED", "permission");
      }
    },
  };

  const approval = {
    async submit(args: any) {
      const id = approvalId(args.companyId, args.documentId, args.approvalCycleKey);
      let request;
      try { request = await audit.getApprovalRequest(id); } catch { request = null; }
      if (!request) {
        request = await audit.createApprovalRequest({
          id, requestType: "purchase-document",
          title: "تأیید سند خرید " + (args.documentNumber ?? args.documentId),
          description: null,
          target: { entityType: "purchase-document", entityId: args.documentId, entityDisplayName: args.documentNumber },
          scope: { companyId: args.companyId, branchId: args.branchId, fiscalYearId: null },
          createdBy: { type: "user", id: args.actorId, displayName: args.actorDisplayName },
          createdAt: now(), correlationId: args.correlationId,
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
    async approve(args: any) {
      const id = approvalId(args.companyId, args.documentId, args.approvalCycleKey);
      let request = await audit.getApprovalRequest(id);
      if (request.status === "pending") {
        request = await audit.approveApprovalRequest({
          approvalRequestId: id,
          actor: { type: "user", id: args.actorId, displayName: args.actorDisplayName },
          comment: args.comment, correlationId: args.correlationId,
        });
      }
      return { requestId: request.id, status: request.status };
    },
    async requireApproved(companyId: string, documentId: string, cycle: string) {
      const request = await audit.getApprovalRequest(approvalId(companyId, documentId, cycle));
      if (request.scope.companyId !== companyId || request.target.entityId !== documentId || request.status !== "approved") {
        throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "approval");
      }
    },
  };

  const auditSink = {
    async record(event: any) {
      try {
        await audit.recordAuditEntry({
          id: "purchase:" + event.action + ":" + event.operationId + ":" + (event.documentId ?? event.operationId),
          occurredAt: event.occurredAt,
          action: event.action.endsWith(".create") ? "create"
            : event.action.endsWith(".submit") ? "submit"
            : event.action.endsWith(".approve") ? "approve"
            : event.action.endsWith(".cancel") ? "cancel" : "status-change",
          outcome: "success", source: "desktop",
          actor: { type: "user", id: event.actorId, displayName: actor.displayName },
          scope: { companyId: event.companyId, branchId: event.branchId, fiscalYearId: null },
          target: { entityType: "purchase-document", entityId: event.documentId ?? event.operationId, entityDisplayName: null },
          message: event.action, reason: event.reason,
          before: event.beforeStatus ? { status: event.beforeStatus } : null,
          after: event.afterStatus ? { status: event.afterStatus } : null,
          correlationId: event.correlationId,
          metadata: { requestId: event.requestId, operationId: event.operationId, purchaseAction: event.action, ...event.metadata },
        });
      } catch (error) {
        if (!(error instanceof Error) || !/already|duplicate|unique/i.test(error.message)) throw error;
      }
    },
  };

  const inventoryReceipt: InventorySourceDocumentPort = {
    async stageDraft(request) {
      const purchase = await uow.execute(context => context.documents.findById(request.companyId, request.sourceDocumentId));
      if (!purchase) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "sourceDocumentId");
      const lines = [];
      for (let index = 0; index < request.lines.length; index += 1) {
        const line = request.lines[index]!;
        const product = await products.getById({ companyId: request.companyId, productId: line.productId });
        const warehouse = await warehouses.getById({ companyId: request.companyId, warehouseId: line.warehouse.warehouseId });
        if (!product || !warehouse) throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "inventory");
        const operation = createInventoryLineOperation({
          companyId: request.companyId, productId: line.productId, product,
          enteredQuantity: line.enteredQuantity, unitId: line.unitId,
          warehouse: line.warehouse,
          resolvedWarehouse: { warehouse, zone: null, location: null },
          destination: null, resolvedDestination: null,
        });
        lines.push(createInventoryDocumentLine({
          lineId: newId(), position: index + 1, productId: line.productId, operation,
          description: line.description,
          sourceReference: {
            companyId: request.companyId, sourceSystem: "purchase",
            documentType: request.sourceDocumentType, documentId: request.sourceDocumentId, lineId: line.sourceLineId,
          },
        }));
      }
      const result = await inventoryDrafts.create({
        companyId: request.companyId, requestKey: request.requestKey, payloadFingerprint: request.payloadFingerprint,
        document: {
          documentId: request.inventoryDocumentId, companyId: request.companyId, documentType: "receipt",
          businessDate: request.businessDate, description: request.description, createdAt: now(),
          scope: {
            branchId: purchase.scope.branchId, destinationBranchId: null,
            fiscalYearId: purchase.scope.fiscalYearId, fiscalPeriodId: purchase.scope.fiscalPeriodId,
          },
          sourceReference: {
            companyId: request.companyId, sourceSystem: "purchase",
            documentType: request.sourceDocumentType, documentId: request.sourceDocumentId, lineId: null,
          },
          lines,
        },
      });
      return { inventoryDocumentId: result.document.documentId, status: result.document.status, version: result.document.version };
    },
  };

  const application = createPurchaseApplicationServices({
    uow,
    fiscalEligibility: {
      async assertOperationAllowed(args) {
        const year = await fiscalYears.findById(args.fiscalYearId);
        const period = await fiscalPeriods.findById(args.fiscalPeriodId);
        if (!year || year.companyId !== args.companyId || year.status !== "open" || !period || period.status !== "open") {
          throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "fiscalScope");
        }
        await validateOperationDate(fiscalPeriods, locks, {
          companyId: args.companyId, branchId: args.branchId, fiscalYearId: args.fiscalYearId,
          operationDate: args.businessDate, scope: "purchases",
        });
      },
    },
    numberReservation: {
      async reserve(args) {
        const entityType = "purchase:" + args.documentType;
        await fiscalUow.run(async ({ numberSeries }) => {
          if (!await numberSeries.findApplicable(args.companyId, args.branchId, args.fiscalYearId, entityType)) {
            await numberSeries.create({
              companyId: args.companyId, entityType, code: entityType, prefix: prefix(args.documentType),
              suffix: "", startNumber: 1, paddingLength: 6, resetPolicy: "fiscal-year",
            });
          }
        });
        return generateDocumentNumber(fiscalUow, {
          companyId: args.companyId, branchId: args.branchId, fiscalYearId: args.fiscalYearId, entityType,
        });
      },
    },
    inventoryReceipt,
    receiptLines: { async findConfirmedLine() { return null; } },
    inventoryMovements: { async findById() { return null; } },
    valuationRecalculation: { async costBasisChanged() {} },
  });

  const secured = new SecuredPurchaseService({
    application,
    documents: { findById: (companyId, documentId) => uow.execute(context => context.documents.findById(companyId, documentId)) },
    authorization, approval, audit: auditSink,
  });
  const security = { actorId: actor.id, actorDisplayName: actor.displayName };

  const lifecycleCommand = (document: PurchaseDocumentSnapshot, action: string, reason?: string | null) => {
    const rid = newId();
    return {
      context: {
        companyId: document.companyId, branchId: document.scope.branchId,
        requestId: rid, operationId: newId(),
        payloadFingerprint: fingerprint([action, document.documentId, document.version, reason ?? null]),
        actorUserId: actor.id, occurredAt: now(),
      },
      documentId: document.documentId, expectedVersion: document.version,
      ...(reason !== undefined ? { reason } : {}),
    };
  };

  return {
    can,
    async list(companyId, branchId, search) {
      const items = await application.queries.listDocuments({
        companyId, branchId, supplierId: null, documentType: null, status: null,
        fromBusinessDate: null, toBusinessDate: null, limit: 200, offset: 0,
      });
      const term = search.trim().toLocaleLowerCase("fa");
      return term ? items.filter(item =>
        (item.documentNumber ?? "").toLocaleLowerCase("fa").includes(term) ||
        item.supplierSnapshot.displayName.toLocaleLowerCase("fa").includes(term)) : items;
    },
    async get(companyId, documentId) {
      const document = await application.queries.getDocument({ companyId, documentId });
      if (!document) return null;
      const facts = await uow.execute(context => context.commercialFacts.listByDocument(companyId, documentId));
      const lineTotals: Record<string, PurchaseLineTotals> = {};
      for (const fact of facts) lineTotals[fact.purchaseLineId] = calculatePurchaseLineTotals(fact.commercialTerms);
      return {
        document, commercialFacts: facts, lineTotals: Object.freeze(lineTotals),
        totals: calculatePurchaseDocumentTotals(Object.values(lineTotals)),
      };
    },
    selectSuppliers: (companyId, search) => parties.select({
      companyId, search: search ?? null, roles: ["supplier"], statuses: ["active"], limit: 100,
    }),
    selectItems: (companyId, search) => productSelector.select({
      companyId, search: search ?? null, kinds: ["product", "service"], statuses: ["active"], purchasable: true, limit: 100,
    }),
    getItem: (companyId, productId) => products.getById({ companyId, productId }),
    selectWarehouses: (companyId, branchId) => warehouses.select({
      companyId, branchId, includeCompanyWide: true, statuses: ["active"], limit: 100,
    }),
    async create(args) {
      if (!args.lines.length) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "lines");
      const year = await fiscalYears.findById(args.fiscalYearId);
      const period = await fiscalPeriods.findByDate(args.fiscalYearId, args.businessDate);
      const activeLocks = await locks.findActiveLocks(args.companyId, args.branchId, "purchases");
      const supplier = await parties.getById({ companyId: args.companyId, partyId: args.supplierId });
      if (!year || year.companyId !== args.companyId || !period || !supplier || !supplier.roles.includes("supplier") || supplier.status !== "active") {
        throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "create");
      }
      const lineInputs = [];
      const commercialTermsByLine: Record<string, ReturnType<typeof createPurchaseCommercialTerms>> = {};
      for (let index = 0; index < args.lines.length; index += 1) {
        const draft = args.lines[index]!;
        const product = await products.getById({ companyId: args.companyId, productId: draft.productId });
        if (!product || product.status !== "active" || !product.capabilities.purchasable) {
          throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "productId");
        }
        const lineId = newId();
        lineInputs.push({
          lineId, position: index + 1,
          lineKind: product.kind === "service" ? "service" as const
            : product.masterData.operational.stockTracking ? "stock-product" as const : "non-stock-product" as const,
          itemId: product.productId, itemType: product.kind, itemSnapshot: itemSnapshot(product),
          description: draft.description,
        });
        commercialTermsByLine[lineId] = termsFor(product, draft);
      }
      const createdAt = now();
      const rid = newId();
      return secured.create(security, {
        context: {
          companyId: args.companyId, branchId: args.branchId, requestId: rid, operationId: newId(),
          payloadFingerprint: fingerprint(args), actorUserId: actor.id, occurredAt: createdAt,
        },
        document: {
          scope: {
            companyId: args.companyId, branchId: args.branchId,
            fiscalYearId: year.id, fiscalPeriodId: period.id,
            fiscalYearStartDate: year.startDate, fiscalYearEndDate: year.endDate,
            fiscalPeriodStartDate: period.startDate, fiscalPeriodEndDate: period.endDate,
            fiscalYearStatus: year.status, fiscalPeriodStatus: period.status,
            lockedThroughDate: activeLocks[0]?.lockedThroughDate ?? null,
          },
          documentId: newId(), companyId: args.companyId, supplierId: supplier.id,
          supplierSnapshot: supplierSnapshot(supplier), documentType: args.documentType,
          businessDate: args.businessDate, description: args.description, createdAt, lines: lineInputs,
        },
        commercialTermsByLine,
      });
    },
    submit: (document, reason) => secured.submit(security, lifecycleCommand(document, "submit", reason)),
    approve: (document, reason) => secured.approve(security, lifecycleCommand(document, "approve", reason)),
    confirm: (document, reason) => secured.confirm(security, lifecycleCommand(document, "confirm", reason)),
    cancel: (document, reason) => secured.cancel(security, lifecycleCommand(document, "cancel", reason)),
    reopen: (document, reason) => secured.reopen(security, lifecycleCommand(document, "reopen", reason)),
    async stageInventoryReceipt(document, warehouseId) {
      const detail = await this.get(document.companyId, document.documentId);
      if (!detail) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "documentId");
      const allocations = document.lines.filter(line => line.lineKind === "stock-product").map(line => {
        const fact = detail.commercialFacts.find(item => item.purchaseLineId === line.lineId);
        if (!fact) throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "commercialFact");
        return {
          purchaseLineId: line.lineId, baseQuantity: fact.commercialTerms.quantity.baseQuantity,
          warehouse: { warehouseId, zoneId: null, locationId: null },
        };
      });
      if (!allocations.length) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "allocations");
      const rid = newId();
      const fp = fingerprint([document.documentId, warehouseId, allocations]);
      return secured.stageInventoryReceipt(security, {
        context: {
          companyId: document.companyId, branchId: document.scope.branchId,
          requestId: rid, operationId: newId(), payloadFingerprint: fp,
          actorUserId: actor.id, occurredAt: now(),
        },
        purchaseDocumentId: document.documentId, inventoryDocumentId: newId(),
        allocations, payloadFingerprint: fp,
      });
    },
  };
}
