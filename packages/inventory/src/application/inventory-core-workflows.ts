import type { InventoryProductReference, InventoryWarehouseResolution } from "../domain/inventory-operation.ts";
import { assertInventoryProductEligible, validateInventoryWarehouseReference } from "../domain/inventory-operation.ts";
import type { InventoryDocumentSnapshot, InventoryLifecycleActionInput } from "../domain/inventory-document.ts";
import { confirmInventoryDocument, rehydrateInventoryDocument } from "../domain/inventory-document.ts";
import type {
  InventoryStockKey,
  InventoryStockLedgerSnapshot,
  InventoryStockMovementSnapshot,
} from "../domain/inventory-stock.ts";
import {
  appendInventoryStockMovement,
  createInventoryStockKey,
  createInventoryStockMovement,
  rebuildInventoryStockLedger,
  serializeInventoryStockKey,
} from "../domain/inventory-stock.ts";
import { INVENTORY_DOMAIN_ERROR_CODES as codes, InventoryDomainError } from "../domain/inventory-errors.ts";

export const INVENTORY_CORE_STOCK_DOCUMENT_TYPES = Object.freeze(["receipt", "issue", "opening"] as const);
export type InventoryCoreStockDocumentType = (typeof INVENTORY_CORE_STOCK_DOCUMENT_TYPES)[number];

/** Current master-data resolution supplied by the authoritative confirmation boundary. */
export interface InventoryLineConfirmationResolution {
  readonly lineId: string;
  readonly product: InventoryProductReference | null;
  readonly warehouse: InventoryWarehouseResolution;
}

/** Durable movement identity allocated outside Domain and bound to one document line. */
export interface InventoryLineMovementIdentity {
  readonly lineId: string;
  readonly movementId: string;
}

/** One opening quantity is allowed per fiscal-year StockKey. */
export interface InventoryOpeningBalanceKey {
  readonly companyId: string;
  readonly fiscalYearId: string;
  readonly stockKey: InventoryStockKey;
}

export interface ConfirmInventoryCoreDocumentInput {
  readonly document: InventoryDocumentSnapshot;
  readonly action: InventoryLifecycleActionInput;
  /** Stable positive order allocated by the authoritative confirmation boundary. */
  readonly businessOrder: number;
  readonly movementIdentities: readonly InventoryLineMovementIdentity[];
  readonly lineResolutions: readonly InventoryLineConfirmationResolution[];
  /** Existing immutable facts. Any supplied balance projection is ignored and rebuilt. */
  readonly ledger: InventoryStockLedgerSnapshot;
  /** Existing confirmed opening uniqueness facts for this company. */
  readonly openingKeys?: readonly InventoryOpeningBalanceKey[];
  readonly allowNegativeStock?: boolean;
}

export interface InventoryCoreConfirmationResult {
  readonly document: InventoryDocumentSnapshot;
  readonly movements: readonly InventoryStockMovementSnapshot[];
  readonly ledger: InventoryStockLedgerSnapshot;
  readonly openingKeys: readonly InventoryOpeningBalanceKey[];
}

const fail = (code: (typeof codes)[keyof typeof codes], field: string): never => {
  throw new InventoryDomainError(code, field);
};

function id(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(codes.identityRequired, field);
  return value.trim();
}

function normalizeOpeningKey(input: InventoryOpeningBalanceKey): InventoryOpeningBalanceKey {
  if (!input || typeof input !== "object" || !input.stockKey || typeof input.stockKey !== "object") {
    return fail(codes.openingKeyInvalid, "openingKey");
  }
  const companyId = id(input.companyId, "openingKey.companyId");
  const fiscalYearId = id(input.fiscalYearId, "openingKey.fiscalYearId");
  const stockKey = createInventoryStockKey({
    companyId: input.stockKey.companyId,
    productId: input.stockKey.productId,
    warehouse: {
      warehouseId: input.stockKey.warehouseId,
      zoneId: input.stockKey.zoneId,
      locationId: input.stockKey.locationId,
    },
  });
  if (stockKey.companyId !== companyId) return fail(codes.openingKeyInvalid, "openingKey.companyId");
  return Object.freeze({ companyId, fiscalYearId, stockKey });
}

export function serializeInventoryOpeningBalanceKey(input: InventoryOpeningBalanceKey): string {
  const key = normalizeOpeningKey(input);
  return JSON.stringify([key.companyId, key.fiscalYearId, serializeInventoryStockKey(key.stockKey)]);
}

function normalizeLineResolutions(
  input: readonly InventoryLineConfirmationResolution[],
): ReadonlyMap<string, InventoryLineConfirmationResolution> {
  if (!Array.isArray(input)) return fail(codes.confirmationResolutionMismatch, "lineResolutions");
  const result = new Map<string, InventoryLineConfirmationResolution>();
  for (const item of input) {
    if (!item || typeof item !== "object") return fail(codes.confirmationResolutionMismatch, "lineResolutions");
    const lineId = id(item.lineId, "lineResolutions.lineId");
    if (result.has(lineId)) return fail(codes.confirmationResolutionMismatch, "lineResolutions.lineId");
    result.set(lineId, item);
  }
  return result;
}

function normalizeMovementIdentities(
  input: readonly InventoryLineMovementIdentity[],
): ReadonlyMap<string, string> {
  if (!Array.isArray(input)) return fail(codes.movementIdentityMismatch, "movementIdentities");
  const byLine = new Map<string, string>();
  const ids = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") return fail(codes.movementIdentityMismatch, "movementIdentities");
    const lineId = id(item.lineId, "movementIdentities.lineId");
    const movementId = id(item.movementId, "movementIdentities.movementId");
    if (byLine.has(lineId) || ids.has(movementId)) return fail(codes.movementIdentityMismatch, "movementIdentities");
    byLine.set(lineId, movementId);
    ids.add(movementId);
  }
  return byLine;
}

function signedBaseQuantity(type: InventoryCoreStockDocumentType, baseQuantity: string): string {
  if (baseQuantity.startsWith("-")) return fail(codes.operationMismatch, "quantity.baseQuantity");
  return type === "issue" ? `-${baseQuantity}` : baseQuantity;
}

/**
 * Pure Step 7 confirmation workflow for receipt, issue and opening documents.
 * It does not persist, allocate numbers/orders/IDs, authorize, or create repository contracts.
 * Callers must resolve current masters in the same authoritative transaction that later persists the result.
 */
export function confirmInventoryReceiptIssueOpening(
  input: ConfirmInventoryCoreDocumentInput,
): InventoryCoreConfirmationResult {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "confirmation");
  const document = rehydrateInventoryDocument(input.document);
  if (!INVENTORY_CORE_STOCK_DOCUMENT_TYPES.includes(document.documentType as InventoryCoreStockDocumentType)) {
    return fail(codes.stockWorkflowUnsupported, "documentType");
  }
  if (document.status !== "approved") return fail(codes.lifecycleTransitionInvalid, "status");
  if (!document.scope || document.documentNumber === null || document.lines.length === 0 ||
      document.lines.some(line => line.operation === null)) {
    return fail(codes.submissionIncomplete, "document");
  }
  if (!Number.isSafeInteger(input.businessOrder) || input.businessOrder < 1) {
    return fail(codes.stockOrderInvalid, "businessOrder");
  }

  const resolutions = normalizeLineResolutions(input.lineResolutions);
  const movementIds = normalizeMovementIdentities(input.movementIdentities);
  if (resolutions.size !== document.lines.length || movementIds.size !== document.lines.length) {
    return fail(codes.confirmationResolutionMismatch, "lines");
  }

  // Never trust a caller-provided balance projection; rebuild from accepted facts first.
  let ledger = rebuildInventoryStockLedger(input.ledger?.movements ?? [], {
    allowNegativeStock: input.allowNegativeStock,
  });
  const movements: InventoryStockMovementSnapshot[] = [];
  const type = document.documentType as InventoryCoreStockDocumentType;

  const existingOpeningKeys = Array.isArray(input.openingKeys) ? input.openingKeys.map(normalizeOpeningKey) : [];
  const openingSet = new Set(existingOpeningKeys.map(serializeInventoryOpeningBalanceKey));
  const newOpeningKeys: InventoryOpeningBalanceKey[] = [];

  for (const line of document.lines) {
    const operation = line.operation;
    if (!operation) return fail(codes.submissionIncomplete, "line.operation");
    if (operation.destination !== null) return fail(codes.operationMismatch, "line.operation.destination");

    const resolution = resolutions.get(line.lineId);
    const movementId = movementIds.get(line.lineId);
    if (!resolution || !movementId || resolution.lineId !== line.lineId) {
      return fail(codes.confirmationResolutionMismatch, "lineId");
    }

    // Revalidate current Product and Warehouse eligibility; historical snapshots remain unchanged.
    assertInventoryProductEligible(document.companyId, line.productId, resolution.product);
    validateInventoryWarehouseReference(document.companyId, operation.warehouse, resolution.warehouse);

    const movement = createInventoryStockMovement({
      movementId,
      companyId: document.companyId,
      documentId: document.documentId,
      lineId: line.lineId,
      productId: line.productId,
      warehouse: operation.warehouse,
      businessDate: document.businessDate,
      businessOrder: input.businessOrder,
      recordedAt: input.action.occurredAt,
      quantityDelta: signedBaseQuantity(type, operation.quantity.baseQuantity),
    });

    if (type === "opening") {
      const openingKey = normalizeOpeningKey({
        companyId: document.companyId,
        fiscalYearId: document.scope.fiscalYearId,
        stockKey: movement.stockKey,
      });
      const serialized = serializeInventoryOpeningBalanceKey(openingKey);
      if (openingSet.has(serialized)) return fail(codes.openingDuplicate, "stockKey");
      openingSet.add(serialized);
      newOpeningKeys.push(openingKey);
    }

    ledger = appendInventoryStockMovement(ledger, movement, {
      allowNegativeStock: input.allowNegativeStock,
    });
    movements.push(movement);
  }

  // Lifecycle confirmation occurs only after every eligibility/stock/opening rule succeeds.
  const confirmed = confirmInventoryDocument(document, input.action);
  return Object.freeze({
    document: confirmed,
    movements: Object.freeze(movements),
    ledger,
    openingKeys: Object.freeze([...existingOpeningKeys, ...newOpeningKeys]),
  });
}
