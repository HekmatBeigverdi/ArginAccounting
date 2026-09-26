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
  type InventoryDocumentSnapshot,
} from "@argin/inventory";
import { SqliteInventoryDocumentRepository, SqliteInventoryUnitOfWork, SqliteInventoryValuationMovementReader, SqliteInventorySourceCostInputService } from "@argin/inventory-tauri";
import { SqlitePartyReader } from "@argin/party-tauri";
import type { PartyDetailDto, PartySelectorDto } from "@argin/party";
import {
  PurchaseApplicationError,
  SecuredPurchaseService,
  calculatePurchaseDocumentTotals,
  calculatePurchaseMatchingStatus,
  calculatePurchaseLineTotals,
  createPurchaseMatchingPolicy,
  evaluatePurchaseMatching,
  type PurchaseMatchingEvaluation,
  createPurchaseApplicationServices,
  createPurchaseCommercialTerms,
  createPurchaseItemSnapshot,
  createPurchaseSupplierSnapshot,
  type PurchaseCommercialFactSnapshot,
  type PurchaseCommercialTerms,
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
  readonly lineId?: string;
  readonly productId: string;
  readonly quantity: string;
  readonly unitId: string;
  readonly unitPrice: number;
  readonly discountRateBasisPoints: number;
  readonly chargeAmount: number;
  readonly description: string | null;
}

export interface PurchaseReceiptFulfillmentLine {
  readonly purchaseLineId: string;
  readonly itemDisplayName: string;
  readonly baseUnitTitle: string;
  readonly invoicedBaseQuantity: string;
  readonly allocatedBaseQuantity: string;
  readonly remainingBaseQuantity: string;
}

export interface PurchaseWorkspaceDetail {
  readonly document: PurchaseDocumentSnapshot;
  readonly commercialFacts: readonly PurchaseCommercialFactSnapshot[];
  readonly lineTotals: Readonly<Record<string, PurchaseLineTotals>>;
  readonly totals: ReturnType<typeof calculatePurchaseDocumentTotals>;
  /** Compatibility pointer for older UI paths; first active linked receipt, if any. */
  readonly inventoryReceipt: Pick<InventoryDocumentSnapshot, "documentId" | "documentNumber" | "status" | "version"> | null;
  readonly inventoryReceipts: readonly Pick<InventoryDocumentSnapshot, "documentId" | "documentNumber" | "status" | "version">[];
  readonly receiptFulfillment: readonly PurchaseReceiptFulfillmentLine[];
  readonly matching: PurchaseMatchingEvaluation | null;
}

export interface PurchaseWorkspaceDraftInput {
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly supplierId: string;
  readonly documentType: PurchaseDocumentType;
  readonly businessDate: string;
  readonly description: string | null;
  readonly correctionReference?: { readonly documentId: string; readonly reason: string } | null;
  readonly lines: readonly PurchaseWorkspaceLineInput[];
}

export interface PurchaseWorkspaceServices {
  matchConfirmedReceipts(document: PurchaseDocumentSnapshot): Promise<PurchaseMatchingEvaluation>;
  resolveReceiptCost(document: PurchaseDocumentSnapshot): Promise<void>;
  readonly can: (permission: PurchasePermission | string) => boolean;
  list(companyId: string, branchId: string, search: string): Promise<readonly PurchaseDocumentSnapshot[]>;
  get(companyId: string, documentId: string): Promise<PurchaseWorkspaceDetail | null>;
  selectSuppliers(companyId: string, search?: string): Promise<readonly PartySelectorDto[]>;
  selectItems(companyId: string, search?: string): Promise<readonly ProductSelectorItemDto[]>;
  getItem(companyId: string, productId: string): Promise<ProductDto | null>;
  selectWarehouses(companyId: string, branchId: string): Promise<readonly WarehouseListItemDto[]>;
  create(input: PurchaseWorkspaceDraftInput): Promise<PurchaseDocumentSnapshot>;
  edit(document: PurchaseDocumentSnapshot, input: PurchaseWorkspaceDraftInput): Promise<PurchaseDocumentSnapshot>;
  submit(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  approve(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  confirm(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  cancel(document: PurchaseDocumentSnapshot, reason?: string | null): Promise<PurchaseDocumentSnapshot>;
  reopen(document: PurchaseDocumentSnapshot, reason: string): Promise<PurchaseDocumentSnapshot>;
  returnPurchase(document: PurchaseDocumentSnapshot, relatedDocumentId: string, reason: string): Promise<PurchaseDocumentSnapshot>;
  correct(document: PurchaseDocumentSnapshot, relatedDocumentId: string, reason: string): Promise<PurchaseDocumentSnapshot>;
  stageInventoryReceipt(
    document: PurchaseDocumentSnapshot,
    warehouseId: string,
    quantitiesByLine: Readonly<Record<string, string>>,
  ): Promise<{ inventoryDocumentId: string; status: string; version: number }>;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const fingerprint = (value: unknown) => JSON.stringify(value);

type QuantityDecimal = { coefficient: bigint; scale: number };
const parseQuantity = (value: string): QuantityDecimal => {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "quantity");
  const [whole = "0", fraction = ""] = normalized.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
};
const quantityScale = (value: QuantityDecimal, scale: number) =>
  value.coefficient * 10n ** BigInt(scale - value.scale);
const quantitySubtract = (left: string, right: string): string => {
  const a = parseQuantity(left), b = parseQuantity(right);
  const scale = Math.max(a.scale, b.scale);
  const result = quantityScale(a, scale) - quantityScale(b, scale);
  if (result < 0n) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "receiptQuantity");
  const digits = result.toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  return (digits.slice(0, -scale) + "." + digits.slice(-scale)).replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
};
const quantityAdd = (left: string, right: string): string => {
  const a = parseQuantity(left), b = parseQuantity(right);
  const scale = Math.max(a.scale, b.scale);
  const result = quantityScale(a, scale) + quantityScale(b, scale);
  const digits = result.toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  return (digits.slice(0, -scale) + "." + digits.slice(-scale)).replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
};
const quantityIsPositive = (value: string) => parseQuantity(value).coefficient > 0n;
const quantityLte = (left: string, right: string) => {
  const a = parseQuantity(left), b = parseQuantity(right);
  const scale = Math.max(a.scale, b.scale);
  return quantityScale(a, scale) <= quantityScale(b, scale);
};

function prefix(type: PurchaseDocumentType): string {
  if (type === "purchase-order") return "PO-";
  if (type === "supplier-invoice") return "PI-";
  if (type === "purchase-return") return "PR-";
  return "PC-";
}

const approvalId = (companyId: string, documentId: string, cycle: string) =>
  "purchase-document:" + companyId + ":" + documentId + ":" + cycle;

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

function termsFor(product: ProductDto, line: PurchaseWorkspaceLineInput, previous?: PurchaseCommercialTerms) {
  if (!product.units) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "unitId");
  const entered = product.units.units.find(unit => unit.unitId === line.unitId);
  const base = product.units.units.find(unit => unit.unitId === product.units!.baseUnitId);
  if (!entered || !base) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "unitId");
  return createPurchaseCommercialTerms({
    enteredQuantity: line.quantity,
    enteredUnit: previous?.quantity.enteredUnit.unitId === line.unitId ? previous.quantity.enteredUnit : {
      unitId: entered.unitId, code: entered.code, title: entered.title,
      ratioToBase: String(entered.ratioToBase), precision: entered.precision,
      roundingMode: entered.roundingMode, taxpayerUnitCode: entered.taxpayerUnitCode ?? null,
    },
    baseUnit: previous?.quantity.enteredUnit.unitId === line.unitId ? previous.quantity.baseUnit : {
      unitId: base.unitId, code: base.code, title: base.title,
      ratioToBase: String(base.ratioToBase), precision: base.precision,
      roundingMode: base.roundingMode, taxpayerUnitCode: base.taxpayerUnitCode ?? null,
    },
    unitPrice: { amount: line.unitPrice, currency: "IRR" },
    discounts: line.discountRateBasisPoints > 0 ? [{ kind: "percentage", rateBasisPoints: line.discountRateBasisPoints }] : [],
    charges: line.chargeAmount > 0 ? [{ kind: "fixed", amount: { amount: line.chargeAmount, currency: "IRR" } }] : [],
    tax: previous?.tax ?? {
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
  const inventoryDocuments = new SqliteInventoryDocumentRepository(database);
  const findReceipts = (document: PurchaseDocumentSnapshot) => inventoryDocuments.listBySource(
    document.companyId, "purchase", document.documentType, document.documentId,
  );
  const findReceipt = async (document: PurchaseDocumentSnapshot) =>
    (await findReceipts(document)).find(receipt => receipt.status !== "cancelled" && receipt.status !== "reversed") ?? null;
  const parties = new SqlitePartyReader(database);
  const products = new SqliteProductReader(database);
  const productSelector = new SqliteProductSelectorReader(database);
  const warehouses = new SqliteWarehouseReader(database);
  const fiscalYears = new SqliteFiscalYearRepository(database);
  const fiscalPeriods = new SqliteFiscalPeriodRepository(database);
  const locks = new SqliteHistoricalLockRepository(database);

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
            : event.action.endsWith(".edit") ? "update"
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
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
        if (!/\bUNIQUE constraint failed: audit_entries\.id\s*$/i.test(message)) throw error;
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
      async reserve(args, context) {
        const fiscalUow = SqliteFiscalUnitOfWork.fromSession(uow.sessionFor(context));
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
    receiptLines: {
      async findConfirmedLine({ companyId, receiptDocumentId, receiptLineId }) {
        const receipt = await inventoryDocuments.findById(companyId, receiptDocumentId);
        const line = receipt?.lines.find(item => item.lineId === receiptLineId);
        if (receipt?.documentType !== "receipt" || receipt.status !== "confirmed" || !line?.operation) return null;
        return { companyId, documentId: receipt.documentId, lineId: line.lineId,
          documentType: receipt.documentType, status: receipt.status, productId: line.productId,
          baseQuantity: line.operation.quantity.baseQuantity };
      },
    },
    inventoryMovements: new SqliteInventoryValuationMovementReader(database),
    valuationRecalculation: {
      async costBasisChanged({ companyId, movement }) {
        const cost = await uow.execute(context => context.costInputs.findByMovement(companyId, movement.movementId));
        if (!cost) throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "costInput");
        await new SqliteInventorySourceCostInputService(database).accept(companyId, cost.basis);
      },
    },
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

  async function evaluateMatching(detail: PurchaseWorkspaceDetail): Promise<PurchaseMatchingEvaluation | null> {
    const invoice = detail.document;
    if (invoice.documentType !== "supplier-invoice" || invoice.status !== "confirmed") return null;

    const invoiceLines = [];
    for (const line of invoice.lines.filter(item => item.lineKind === "stock-product")) {
      const fact = detail.commercialFacts.find(item => item.purchaseLineId === line.lineId);
      if (!fact) throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "commercialFact");
      invoiceLines.push({
        invoiceLineId: line.lineId,
        productId: line.itemId,
        baseQuantity: fact.commercialTerms.quantity.baseQuantity,
        unitPriceAmount: fact.commercialTerms.unitPrice.amount,
        orderLineId:
          line.sourceReference?.sourceSystem === "purchase"
            ? line.sourceReference.sourceLineId
            : null,
      });
    }
    if (!invoiceLines.length) return null;

    const receiptLines = [];
    for (const receiptRef of detail.inventoryReceipts) {
      const receipt = await inventoryDocuments.findById(invoice.companyId, receiptRef.documentId);
      if (!receipt || receipt.status !== "confirmed") continue;
      for (const line of receipt.lines) {
        if (!line.operation ||
            line.sourceReference?.sourceSystem !== "purchase" ||
            line.sourceReference.documentId !== invoice.documentId ||
            !line.sourceReference.lineId) continue;
        receiptLines.push({
          receiptDocumentId: receipt.documentId,
          receiptLineId: line.lineId,
          sourceInvoiceLineId: line.sourceReference.lineId,
          productId: line.productId,
          baseQuantity: line.operation.quantity.baseQuantity,
        });
      }
    }

    const existingMatches = [];
    for (const line of invoiceLines) {
      existingMatches.push(...await uow.execute(context =>
        context.matches.listByInvoiceLine(invoice.companyId, invoice.documentId, line.invoiceLineId)));
    }

    let orderLines: Array<{
      orderLineId: string;
      productId: string;
      baseQuantity: string;
      unitPriceAmount: number;
    }> | undefined;
    const orderId =
      invoice.sourceReference?.sourceSystem === "purchase"
        ? invoice.sourceReference.sourceDocumentId
        : null;
    if (orderId) {
      const order = await uow.execute(context => context.documents.findById(invoice.companyId, orderId));
      if (order?.documentType === "purchase-order" && order.status === "confirmed") {
        const orderFacts = await uow.execute(context => context.commercialFacts.listByDocument(invoice.companyId, order.documentId));
        orderLines = order.lines
          .filter(line => line.lineKind === "stock-product")
          .flatMap(line => {
            const fact = orderFacts.find(item => item.purchaseLineId === line.lineId);
            return fact ? [{
              orderLineId: line.lineId,
              productId: line.itemId,
              baseQuantity: fact.commercialTerms.quantity.baseQuantity,
              unitPriceAmount: fact.commercialTerms.unitPrice.amount,
            }] : [];
          });
      }
    }

    return evaluatePurchaseMatching({
      invoiceLines,
      receiptLines,
      existingMatches,
      orderLines,
      // Step 28 freezes exact quantity and zero price variance by default.
      // A configurable company tolerance can replace this value in the settings step.
      policy: createPurchaseMatchingPolicy(0),
    });
  }

  async function prepareDraft(args: PurchaseWorkspaceDraftInput, previous?: PurchaseWorkspaceDetail) {
    if (!args.lines.length) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "lines");
    const year = await fiscalYears.findById(args.fiscalYearId);
    if (!year || year.companyId !== args.companyId) {
      throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "fiscalYearId");
    }
    if (args.businessDate < year.startDate || args.businessDate > year.endDate) {
      throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "businessDate");
    }
    const period = await fiscalPeriods.findByDate(args.fiscalYearId, args.businessDate);
    if (!period) {
      throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "fiscalPeriodId");
    }
    const activeLocks = await locks.findActiveLocks(args.companyId, args.branchId, "purchases");
    const supplier = await parties.getById({ companyId: args.companyId, partyId: args.supplierId });
    if (!supplier) {
      throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "supplierId");
    }
    if (!supplier.roles.includes("supplier")) {
      throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "supplierRole");
    }
    if (supplier.status !== "active") {
      throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "supplierStatus");
    }
    const lineInputs = [];
    const commercialTermsByLine: Record<string, ReturnType<typeof createPurchaseCommercialTerms>> = {};
    for (let index = 0; index < args.lines.length; index += 1) {
      const draft = args.lines[index]!;
      const product = await products.getById({ companyId: args.companyId, productId: draft.productId });
      if (!product || product.status !== "active" || !product.capabilities.purchasable) {
        throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "productId");
      }
      const existing = draft.lineId ? previous?.document.lines.find(line => line.lineId === draft.lineId) : undefined;
      if (draft.lineId && !existing) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "lineId");
      const sameItem = existing?.itemId === product.productId ? existing : undefined;
      const priorTerms = sameItem
        ? previous?.commercialFacts.find(fact => fact.purchaseLineId === sameItem.lineId)?.commercialTerms
        : undefined;
      const lineId = existing?.lineId ?? newId();
      lineInputs.push({
        lineId, position: index + 1,
        lineKind: sameItem?.lineKind ?? (product.kind === "service" ? "service" as const
          : product.masterData.operational.stockTracking ? "stock-product" as const : "non-stock-product" as const),
        itemId: product.productId, itemType: product.kind, itemSnapshot: sameItem?.itemSnapshot ?? itemSnapshot(product),
        description: draft.description,
        sourceReference: existing?.sourceReference ?? null,
      });
      commercialTermsByLine[lineId] = termsFor(product, draft, priorTerms);
    }
    const createdAt = now();
    return {
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
        businessDate: args.businessDate, description: args.description,
        correctionReference: args.correctionReference ?? null,
        createdAt, lines: lineInputs,
      },
      commercialTermsByLine,
    };
  }

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
      const linkedReceipts = await findReceipts(document);
      const activeReceipts = linkedReceipts.filter(receipt => receipt.status !== "cancelled" && receipt.status !== "reversed");
      const allocatedByLine = new Map<string, string>();
      for (const receipt of activeReceipts) {
        for (const line of receipt.lines) {
          const sourceLineId = line.sourceReference?.lineId ?? null;
          if (!sourceLineId || !line.operation) continue;
          allocatedByLine.set(
            sourceLineId,
            quantityAdd(allocatedByLine.get(sourceLineId) ?? "0", line.operation.quantity.baseQuantity),
          );
        }
      }
      const receiptFulfillment = document.lines
        .filter(line => line.lineKind === "stock-product")
        .map(line => {
          const fact = facts.find(item => item.purchaseLineId === line.lineId);
          if (!fact) throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "commercialFact");
          const invoiced = fact.commercialTerms.quantity.baseQuantity;
          const allocated = allocatedByLine.get(line.lineId) ?? "0";
          if (!quantityLte(allocated, invoiced)) {
            throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "receiptQuantity");
          }
          return Object.freeze({
            purchaseLineId: line.lineId,
            itemDisplayName: line.itemSnapshot.displayName,
            baseUnitTitle: fact.commercialTerms.quantity.baseUnit.title,
            invoicedBaseQuantity: invoiced,
            allocatedBaseQuantity: allocated,
            remainingBaseQuantity: quantitySubtract(invoiced, allocated),
          });
        });
      const baseDetail: PurchaseWorkspaceDetail = {
        document, commercialFacts: facts, lineTotals: Object.freeze(lineTotals),
        totals: calculatePurchaseDocumentTotals(Object.values(lineTotals)),
        inventoryReceipt: activeReceipts[0] ?? null,
        inventoryReceipts: Object.freeze(activeReceipts.map(receipt => Object.freeze({
          documentId: receipt.documentId,
          documentNumber: receipt.documentNumber,
          status: receipt.status,
          version: receipt.version,
        }))),
        receiptFulfillment: Object.freeze(receiptFulfillment),
        matching: null,
      };
      return {
        ...baseDetail,
        matching: await evaluateMatching(baseDetail),
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
      const prepared = await prepareDraft(args);
      return secured.create(security, {
        context: {
          companyId: args.companyId, branchId: args.branchId, requestId: newId(), operationId: newId(),
          payloadFingerprint: fingerprint(args), actorUserId: actor.id, occurredAt: prepared.document.createdAt,
        },
        ...prepared,
      });
    },
    async edit(document, args) {
      await authorization.require({ branchId: document.scope.branchId }, "purchases.documents.edit");
      if (args.companyId !== document.companyId || args.branchId !== document.scope.branchId ||
          args.fiscalYearId !== document.scope.fiscalYearId || args.documentType !== document.documentType) {
        throw new PurchaseApplicationError("PURCHASE_APP_SCOPE_MISMATCH", "scope");
      }
      const previous = await this.get(document.companyId, document.documentId);
      if (!previous) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "documentId");
      const prepared = await prepareDraft(args, previous);
      const command = lifecycleCommand(document, "edit");
      return secured.edit(security, {
        ...command,
        context: { ...command.context, payloadFingerprint: fingerprint([document.documentId, document.version, args]) },
        changes: prepared.document,
        commercialTermsByLine: prepared.commercialTermsByLine,
      });
    },
    submit: (document, reason) => secured.submit(security, lifecycleCommand(document, "submit", reason)),
    approve: (document, reason) => secured.approve(security, lifecycleCommand(document, "approve", reason)),
    confirm: (document, reason) => secured.confirm(security, lifecycleCommand(document, "confirm", reason)),
    cancel: (document, reason) => secured.cancel(security, lifecycleCommand(document, "cancel", reason)),
    reopen: (document, reason) => secured.reopen(security, lifecycleCommand(document, "reopen", reason)),
    returnPurchase: (document, relatedDocumentId, reason) => secured.returnPurchase(security, {
      ...lifecycleCommand(document, "return", reason),
      relatedDocumentId,
    }),
    correct: (document, relatedDocumentId, reason) => secured.correct(security, {
      ...lifecycleCommand(document, "correct", reason),
      relatedDocumentId,
    }),
    async matchConfirmedReceipts(document) {
      const current = await this.get(document.companyId, document.documentId);
      if (!current) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "documentId");
      await authorization.require({ branchId: current.document.scope.branchId }, "purchases.matching.manage");
      if (current.document.documentType !== "supplier-invoice" || current.document.status !== "confirmed") {
        throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "matchingSource");
      }
      const evaluation = current.matching;
      if (!evaluation) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "matching");
      for (const proposal of evaluation.proposals) {
        const key = `auto-match:${current.document.documentId}:${proposal.receiptDocumentId}:${proposal.receiptLineId}`;
        await secured.matchReceiptInvoice(security, {
          context: {
            companyId: current.document.companyId,
            branchId: current.document.scope.branchId,
            requestId: key,
            operationId: key,
            payloadFingerprint: fingerprint(proposal),
            actorUserId: actor.id,
            occurredAt: now(),
          },
          match: {
            matchId: key,
            companyId: current.document.companyId,
            invoiceDocumentId: current.document.documentId,
            invoiceLineId: proposal.invoiceLineId,
            receiptDocumentId: proposal.receiptDocumentId,
            receiptLineId: proposal.receiptLineId,
            productId: proposal.productId,
            matchedBaseQuantity: proposal.matchedBaseQuantity,
          },
        });
      }
      const refreshed = await this.get(document.companyId, document.documentId);
      if (!refreshed?.matching) throw new PurchaseApplicationError("PURCHASE_APP_DEPENDENCY_INVALID", "matching");
      return refreshed.matching;
    },
    async resolveReceiptCost(document) {
      const currentDetail = await this.get(document.companyId, document.documentId);
      if (!currentDetail) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "documentId");
      const current = currentDetail.document;
      await authorization.require({ branchId: current.scope.branchId }, "purchases.matching.manage");
      await authorization.require({ branchId: current.scope.branchId }, "purchases.cost-resolution.manage");
      if (current.documentType !== "supplier-invoice" || current.status !== "confirmed") {
        throw new Error("ثبت مبنای هزینه فقط برای فاکتور تأمین‌کننده قطعی مجاز است.");
      }
      if (currentDetail.matching?.status !== "matched") {
        throw new Error("ابتدا تطبیق خرید را کامل کنید.");
      }

      const confirmedReceipts: InventoryDocumentSnapshot[] = [];
      for (const receiptRef of currentDetail.inventoryReceipts) {
        const receipt = await inventoryDocuments.findById(current.companyId, receiptRef.documentId);
        if (!receipt || receipt.documentType !== "receipt" || receipt.status !== "confirmed" ||
            receipt.scope?.branchId !== current.scope.branchId) continue;
        confirmedReceipts.push(receipt);
      }
      if (!confirmedReceipts.length) {
        throw new Error("رسید قطعی مرتبط در همان شعبه یافت نشد.");
      }

      const allMovements: Array<{ receipt: InventoryDocumentSnapshot; movement_id: string; line_id: string }> = [];
      for (const receipt of confirmedReceipts) {
        const movements = await database.query<{ movement_id: string; line_id: string }>(
          "SELECT movement_id,line_id FROM inventory_stock_movements WHERE company_id=? AND document_id=? AND reversal_of_movement_id IS NULL",
          [current.companyId, receipt.documentId],
        );
        for (const movement of movements) allMovements.push({ receipt, ...movement });
      }
      if (!allMovements.length) throw new Error("گردش قطعی موجودی برای رسیدهای مرتبط یافت نشد.");

      for (const movement of allMovements) {
        const cost = await database.queryOne<{ basis_line_id: string }>(
          "SELECT basis_line_id FROM inventory_valuation_cost_inputs WHERE company_id=? AND movement_id=?",
          [current.companyId, movement.movement_id],
        );
        if (cost && cost.basis_line_id !== `purchase-cost:${movement.movement_id}`) {
          throw new Error("برای یکی از رسیدها قبلاً مبنای هزینه دیگری ثبت شده است؛ اصلاح هزینه باید از مسیر ارزش‌گذاری انجام شود.");
        }
        const line = movement.receipt.lines.find(item => item.lineId === movement.line_id);
        const source = line?.sourceReference;
        if (!line?.operation || source?.sourceSystem !== "purchase" ||
            source.documentId !== current.documentId || !source.lineId) {
          throw new Error("ارتباط ردیف رسید با ردیف فاکتور مشخص نیست.");
        }
        const existing = await uow.execute(context =>
          context.matches.listByReceiptLine(current.companyId, movement.receipt.documentId, line.lineId));
        const coverage = calculatePurchaseMatchingStatus(
          line.operation.quantity.baseQuantity,
          existing.map(match => match.matchedBaseQuantity),
        );
        if (coverage.status !== "fully-matched" ||
            existing.some(match =>
              match.invoiceDocumentId !== current.documentId ||
              match.invoiceLineId !== source.lineId)) {
          throw new Error("یکی از رسیدهای قطعی هنوز به‌طور کامل با فاکتور تطبیق نشده است.");
        }
      }

      for (const movement of allMovements) {
        const key = `purchase-cost:${movement.movement_id}`;
        const result = await secured.resolveMovementCost(security, {
          context: {
            companyId: current.companyId,
            branchId: current.scope.branchId,
            requestId: key,
            operationId: key,
            payloadFingerprint: key,
            actorUserId: actor.id,
            occurredAt: now(),
          },
          movementId: movement.movement_id,
          costInputId: key,
        });
        if (result.status !== "resolved") {
          throw new Error("مبنای هزینه یکی از دریافت‌های تطبیق‌شده هنوز قابل حل نیست.");
        }
      }
    },

    async stageInventoryReceipt(document, warehouseId, quantitiesByLine) {
      await authorization.require({ branchId: document.scope.branchId }, "purchases.receipts.stage");
      const detail = await this.get(document.companyId, document.documentId);
      if (!detail) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "documentId");
      document = detail.document;
      if (document.documentType !== "supplier-invoice" || document.status !== "confirmed") {
        throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "receiptSource");
      }
      const allocations = detail.receiptFulfillment.flatMap(line => {
        const requested = quantitiesByLine[line.purchaseLineId]?.trim() || "0";
        if (!quantityIsPositive(requested)) return [];
        if (!quantityLte(requested, line.remainingBaseQuantity)) {
          throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "receiptQuantity");
        }
        return [{
          purchaseLineId: line.purchaseLineId,
          baseQuantity: requested,
          warehouse: { warehouseId, zoneId: null, locationId: null },
        }];
      });
      if (!allocations.length) throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "allocations");
      const rid = newId();
      const fp = fingerprint([document.documentId, warehouseId, allocations]);
      try {
        return await secured.stageInventoryReceipt(security, {
          context: {
            companyId: document.companyId, branchId: document.scope.branchId,
            requestId: rid, operationId: newId(), payloadFingerprint: fp,
            actorUserId: actor.id, occurredAt: now(),
          },
          purchaseDocumentId: document.documentId, inventoryDocumentId: newId(),
          allocations, payloadFingerprint: fp,
        });
      } catch (error) {
        throw error;
      }
    },
  };
}
