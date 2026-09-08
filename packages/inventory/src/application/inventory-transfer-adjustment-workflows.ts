import type { InventoryProductReference, InventoryWarehouseResolution } from "../domain/inventory-operation.ts";
import { assertInventoryProductEligible, validateInventoryWarehouseReference } from "../domain/inventory-operation.ts";
import type { InventoryDocumentSnapshot, InventoryLifecycleActionInput } from "../domain/inventory-document.ts";
import { confirmInventoryDocument, rehydrateInventoryDocument } from "../domain/inventory-document.ts";
import type { InventoryStockLedgerSnapshot, InventoryStockMovementSnapshot } from "../domain/inventory-stock.ts";
import {
  addInventoryStockQuantities,
  createInventoryStockMovement,
  rebuildInventoryStockLedger,
  serializeInventoryStockKey,
} from "../domain/inventory-stock.ts";
import { INVENTORY_DOMAIN_ERROR_CODES as codes, InventoryDomainError } from "../domain/inventory-errors.ts";
import type { InventoryScopeContext, InventoryScopeReaders } from "./inventory-scope-validation.ts";
import { validateInventoryDocumentScope } from "./inventory-scope-validation.ts";

export interface InventoryTransferLineResolution {
  readonly lineId: string;
  readonly product: InventoryProductReference | null;
  readonly sourceWarehouse: InventoryWarehouseResolution;
  readonly destinationWarehouse: InventoryWarehouseResolution;
}

export interface InventoryTransferLineMovementIdentity {
  readonly lineId: string;
  readonly sourceMovementId: string;
  readonly destinationMovementId: string;
}

export interface ConfirmInventoryTransferInput {
  readonly document: InventoryDocumentSnapshot;
  readonly action: InventoryLifecycleActionInput;
  readonly scopeContext: InventoryScopeContext;
  readonly scopeReaders: InventoryScopeReaders;
  readonly transferId: string;
  readonly businessOrder: number;
  readonly movementIdentities: readonly InventoryTransferLineMovementIdentity[];
  readonly lineResolutions: readonly InventoryTransferLineResolution[];
  readonly ledger: InventoryStockLedgerSnapshot;
  readonly allowNegativeStock?: boolean;
}

export interface ConfirmInventoryAdjustmentInput {
  readonly document: InventoryDocumentSnapshot;
  readonly action: InventoryLifecycleActionInput;
  readonly scopeContext: InventoryScopeContext;
  readonly scopeReaders: InventoryScopeReaders;
  readonly businessOrder: number;
  readonly movementIdentities: readonly { readonly lineId: string; readonly movementId: string }[];
  readonly lineResolutions: readonly {
    readonly lineId: string;
    readonly product: InventoryProductReference | null;
    readonly warehouse: InventoryWarehouseResolution;
  }[];
  readonly ledger: InventoryStockLedgerSnapshot;
  readonly allowNegativeStock?: boolean;
}

export interface InventoryStockWorkflowResult {
  readonly document: InventoryDocumentSnapshot;
  readonly movements: readonly InventoryStockMovementSnapshot[];
  readonly ledger: InventoryStockLedgerSnapshot;
}

const fail = (code: (typeof codes)[keyof typeof codes], field: string): never => {
  throw new InventoryDomainError(code, field);
};

function id(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(codes.identityRequired, field);
  return value.trim();
}

function transferIdentity(value: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(codes.transferIdentityInvalid, "transferId");
  return value.trim();
}

function reason(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return fail(codes.adjustmentReasonRequired, "reason");
  return value.trim();
}

function assertBaseInput(
  input: { readonly action: InventoryLifecycleActionInput; readonly businessOrder: number; readonly ledger: InventoryStockLedgerSnapshot },
): void {
  if (!input.action || typeof input.action !== "object") fail(codes.inputInvalid, "action");
  if (!Number.isSafeInteger(input.businessOrder) || input.businessOrder < 1) {
    fail(codes.stockOrderInvalid, "businessOrder");
  }
  if (!input.ledger || typeof input.ledger !== "object" || !Array.isArray(input.ledger.movements)) {
    fail(codes.inputInvalid, "ledger");
  }
}

function assertApprovedComplete(document: InventoryDocumentSnapshot): void {
  if (document.status !== "approved") fail(codes.lifecycleTransitionInvalid, "status");
  if (!document.scope || document.documentNumber === null || document.lines.length === 0 ||
      document.lines.some(line => line.operation === null)) {
    fail(codes.submissionIncomplete, "document");
  }
}

function transferResolutionMap(input: readonly InventoryTransferLineResolution[]): ReadonlyMap<string, InventoryTransferLineResolution> {
  if (!Array.isArray(input)) return fail(codes.confirmationResolutionMismatch, "lineResolutions");
  const result = new Map<string, InventoryTransferLineResolution>();
  for (const item of input) {
    if (!item || typeof item !== "object") return fail(codes.confirmationResolutionMismatch, "lineResolutions");
    const lineId = id(item.lineId, "lineResolutions.lineId");
    if (result.has(lineId)) return fail(codes.confirmationResolutionMismatch, "lineResolutions.lineId");
    result.set(lineId, item);
  }
  return result;
}

function transferIdentityMap(input: readonly InventoryTransferLineMovementIdentity[]): ReadonlyMap<string, InventoryTransferLineMovementIdentity> {
  if (!Array.isArray(input)) return fail(codes.movementIdentityMismatch, "movementIdentities");
  const result = new Map<string, InventoryTransferLineMovementIdentity>();
  const movementIds = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") return fail(codes.movementIdentityMismatch, "movementIdentities");
    const lineId = id(item.lineId, "movementIdentities.lineId");
    const sourceMovementId = id(item.sourceMovementId, "movementIdentities.sourceMovementId");
    const destinationMovementId = id(item.destinationMovementId, "movementIdentities.destinationMovementId");
    if (sourceMovementId === destinationMovementId || result.has(lineId) ||
        movementIds.has(sourceMovementId) || movementIds.has(destinationMovementId)) {
      return fail(codes.movementIdentityMismatch, "movementIdentities");
    }
    movementIds.add(sourceMovementId);
    movementIds.add(destinationMovementId);
    result.set(lineId, Object.freeze({ lineId, sourceMovementId, destinationMovementId }));
  }
  return result;
}

/**
 * Pure Step 8 transfer workflow. Both sides are constructed first and the complete batch is
 * evaluated against the immutable ledger in one rebuild. No partial ledger is returned on failure.
 */
export async function confirmInventoryTransfer(
  input: ConfirmInventoryTransferInput,
): Promise<InventoryStockWorkflowResult> {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "transferConfirmation");
  assertBaseInput(input);
  const transferId = transferIdentity(input.transferId);
  const document = rehydrateInventoryDocument(input.document);
  if (document.documentType !== "transfer") return fail(codes.stockWorkflowUnsupported, "documentType");
  assertApprovedComplete(document);
  if (!input.scopeContext || typeof input.scopeContext !== "object" || !input.scopeReaders || typeof input.scopeReaders !== "object") {
    return fail(codes.inputInvalid, "scope");
  }

  const scopedDocument = await validateInventoryDocumentScope(document, input.scopeContext, input.scopeReaders);
  const resolutions = transferResolutionMap(input.lineResolutions);
  const identities = transferIdentityMap(input.movementIdentities);
  if (resolutions.size !== scopedDocument.lines.length || identities.size !== scopedDocument.lines.length) {
    return fail(codes.confirmationResolutionMismatch, "lines");
  }
  if (input.ledger.movements.some(movement => movement.transferId === transferId)) {
    return fail(codes.transferIdentityInvalid, "transferId");
  }

  const movements: InventoryStockMovementSnapshot[] = [];
  for (const line of scopedDocument.lines) {
    const operation = line.operation;
    if (!operation || !operation.destination) return fail(codes.operationMismatch, "line.operation.destination");
    const resolution = resolutions.get(line.lineId);
    const identity = identities.get(line.lineId);
    if (!resolution || !identity) return fail(codes.confirmationResolutionMismatch, "lineId");

    assertInventoryProductEligible(scopedDocument.companyId, line.productId, resolution.product);
    validateInventoryWarehouseReference(scopedDocument.companyId, operation.warehouse, resolution.sourceWarehouse);
    validateInventoryWarehouseReference(scopedDocument.companyId, operation.destination, resolution.destinationWarehouse);

    const source = createInventoryStockMovement({
      movementId: identity.sourceMovementId,
      companyId: scopedDocument.companyId,
      documentId: scopedDocument.documentId,
      lineId: line.lineId,
      productId: line.productId,
      warehouse: operation.warehouse,
      businessDate: scopedDocument.businessDate,
      businessOrder: input.businessOrder,
      recordedAt: input.action.occurredAt,
      transferId,
      quantityDelta: `-${operation.quantity.baseQuantity}`,
    });
    const destination = createInventoryStockMovement({
      movementId: identity.destinationMovementId,
      companyId: scopedDocument.companyId,
      documentId: scopedDocument.documentId,
      lineId: line.lineId,
      productId: line.productId,
      warehouse: operation.destination,
      businessDate: scopedDocument.businessDate,
      businessOrder: input.businessOrder,
      recordedAt: input.action.occurredAt,
      transferId,
      quantityDelta: operation.quantity.baseQuantity,
    });
    if (serializeInventoryStockKey(source.stockKey) === serializeInventoryStockKey(destination.stockKey)) {
      return fail(codes.transferConservationInvalid, "stockKey");
    }
    if (addInventoryStockQuantities(source.quantityDelta, destination.quantityDelta) !== "0") {
      return fail(codes.transferConservationInvalid, "quantityDelta");
    }
    movements.push(source, destination);
  }

  const ledger = rebuildInventoryStockLedger([...input.ledger.movements, ...movements], {
    allowNegativeStock: input.allowNegativeStock === true,
  });
  const confirmed = confirmInventoryDocument(scopedDocument, input.action);
  return Object.freeze({ document: confirmed, movements: Object.freeze(movements), ledger });
}

function adjustmentResolutionMap(
  input: ConfirmInventoryAdjustmentInput["lineResolutions"],
): ReadonlyMap<string, ConfirmInventoryAdjustmentInput["lineResolutions"][number]> {
  if (!Array.isArray(input)) return fail(codes.confirmationResolutionMismatch, "lineResolutions");
  const result = new Map<string, ConfirmInventoryAdjustmentInput["lineResolutions"][number]>();
  for (const item of input) {
    if (!item || typeof item !== "object") return fail(codes.confirmationResolutionMismatch, "lineResolutions");
    const lineId = id(item.lineId, "lineResolutions.lineId");
    if (result.has(lineId)) return fail(codes.confirmationResolutionMismatch, "lineResolutions.lineId");
    result.set(lineId, item);
  }
  return result;
}

function adjustmentIdentityMap(
  input: ConfirmInventoryAdjustmentInput["movementIdentities"],
): ReadonlyMap<string, string> {
  if (!Array.isArray(input)) return fail(codes.movementIdentityMismatch, "movementIdentities");
  const result = new Map<string, string>();
  const movementIds = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") return fail(codes.movementIdentityMismatch, "movementIdentities");
    const lineId = id(item.lineId, "movementIdentities.lineId");
    const movementId = id(item.movementId, "movementIdentities.movementId");
    if (result.has(lineId) || movementIds.has(movementId)) return fail(codes.movementIdentityMismatch, "movementIdentities");
    result.set(lineId, movementId);
    movementIds.add(movementId);
  }
  return result;
}

/** Quantity adjustment uses the signed base quantity captured on each line; reason is mandatory. */
export async function confirmInventoryQuantityAdjustment(
  input: ConfirmInventoryAdjustmentInput,
): Promise<InventoryStockWorkflowResult> {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "adjustmentConfirmation");
  assertBaseInput(input);
  const normalizedReason = reason(input.action.reason);
  const document = rehydrateInventoryDocument(input.document);
  if (document.documentType !== "adjustment") return fail(codes.stockWorkflowUnsupported, "documentType");
  assertApprovedComplete(document);
  if (!input.scopeContext || typeof input.scopeContext !== "object" || !input.scopeReaders || typeof input.scopeReaders !== "object") {
    return fail(codes.inputInvalid, "scope");
  }

  const scopedDocument = await validateInventoryDocumentScope(document, input.scopeContext, input.scopeReaders);
  const resolutions = adjustmentResolutionMap(input.lineResolutions);
  const identities = adjustmentIdentityMap(input.movementIdentities);
  if (resolutions.size !== scopedDocument.lines.length || identities.size !== scopedDocument.lines.length) {
    return fail(codes.confirmationResolutionMismatch, "lines");
  }

  const movements: InventoryStockMovementSnapshot[] = [];
  for (const line of scopedDocument.lines) {
    const operation = line.operation;
    if (!operation || operation.destination !== null) return fail(codes.operationMismatch, "line.operation");
    const resolution = resolutions.get(line.lineId);
    const movementId = identities.get(line.lineId);
    if (!resolution || !movementId) return fail(codes.confirmationResolutionMismatch, "lineId");

    assertInventoryProductEligible(scopedDocument.companyId, line.productId, resolution.product);
    validateInventoryWarehouseReference(scopedDocument.companyId, operation.warehouse, resolution.warehouse);
    movements.push(createInventoryStockMovement({
      movementId,
      companyId: scopedDocument.companyId,
      documentId: scopedDocument.documentId,
      lineId: line.lineId,
      productId: line.productId,
      warehouse: operation.warehouse,
      businessDate: scopedDocument.businessDate,
      businessOrder: input.businessOrder,
      recordedAt: input.action.occurredAt,
      quantityDelta: operation.quantity.baseQuantity,
    }));
  }

  const ledger = rebuildInventoryStockLedger([...input.ledger.movements, ...movements], {
    allowNegativeStock: input.allowNegativeStock === true,
  });
  const confirmed = confirmInventoryDocument(scopedDocument, { ...input.action, reason: normalizedReason });
  return Object.freeze({ document: confirmed, movements: Object.freeze(movements), ledger });
}
