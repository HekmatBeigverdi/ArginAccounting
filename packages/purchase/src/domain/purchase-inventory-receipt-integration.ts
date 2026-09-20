import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";
import { normalizePurchaseQuantity } from "./purchase-commercial-semantics.ts";
import type { PurchaseCommercialTerms } from "./purchase-commercial-semantics.ts";
import type { PurchaseDocumentSnapshot } from "./purchase-document.ts";

export interface PurchaseInventoryWarehouseReference {
  readonly warehouseId: string;
  readonly zoneId: string | null;
  readonly locationId: string | null;
}

export interface PurchaseInventoryReceiptCommercialFact {
  readonly purchaseLineId: string;
  readonly commercialTerms: PurchaseCommercialTerms;
}

export interface PurchaseInventoryReceiptAllocation {
  readonly purchaseLineId: string;
  /** Quantity to stage, expressed in the Purchase line's captured base unit. */
  readonly baseQuantity: string;
  readonly warehouse: PurchaseInventoryWarehouseReference;
  readonly description?: string | null;
}

export interface PurchaseInventoryReceiptStageLine {
  readonly sourceLineId: string;
  readonly productId: string;
  readonly enteredQuantity: string;
  readonly unitId: string;
  readonly warehouse: PurchaseInventoryWarehouseReference;
  readonly description: string | null;
}

/** Structurally compatible with Inventory's StageInventorySourceDocumentRequest. */
export interface PurchaseInventoryReceiptStageRequest {
  readonly companyId: string;
  readonly inventoryDocumentId: string;
  readonly documentType: "receipt";
  readonly businessDate: string;
  readonly sourceSystem: "purchase";
  readonly sourceDocumentType: "purchase-order" | "supplier-invoice";
  readonly sourceDocumentId: string;
  readonly description: string | null;
  readonly lines: readonly PurchaseInventoryReceiptStageLine[];
  readonly requestKey: string;
  readonly payloadFingerprint: string;
}

export interface PurchaseInventoryReceiptStageResult {
  readonly inventoryDocumentId: string;
  readonly status: "draft" | "submitted" | "approved" | "confirmed" | "cancelled" | "reversed";
  readonly version: number;
}

/** Structurally compatible with InventorySourceDocumentPort. */
export interface PurchaseInventoryReceiptPort {
  stageDraft(request: PurchaseInventoryReceiptStageRequest): Promise<PurchaseInventoryReceiptStageResult>;
}

export interface BuildPurchaseInventoryReceiptRequestInput {
  readonly purchase: PurchaseDocumentSnapshot;
  readonly inventoryDocumentId: string;
  readonly commercialFacts: readonly PurchaseInventoryReceiptCommercialFact[];
  readonly allocations: readonly PurchaseInventoryReceiptAllocation[];
  readonly requestKey: string;
  readonly payloadFingerprint: string;
}

type Decimal = Readonly<{ coefficient: bigint; scale: number }>;

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

const required = (value: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, field);
  }
  return value.trim();
};

const optionalText = (value: string | null | undefined, field: string): string | null => {
  if (value == null) return null;
  if (typeof value !== "string") return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, field);
  return value.trim() || null;
};

function parsePositiveQuantity(value: string, field: string): { canonical: string; decimal: Decimal } {
  let canonical: string;
  try {
    canonical = normalizePurchaseQuantity(value);
  } catch {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, field);
  }
  const [whole = "0", fraction = ""] = canonical.split(".");
  const decimal = { coefficient: BigInt(whole + fraction), scale: fraction.length } as const;
  if (decimal.coefficient <= 0n) return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, field);
  return { canonical, decimal };
}

function compareDecimal(left: Decimal, right: Decimal): number {
  const scale = Math.max(left.scale, right.scale);
  const leftScaled = left.coefficient * 10n ** BigInt(scale - left.scale);
  const rightScaled = right.coefficient * 10n ** BigInt(scale - right.scale);
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

function normalizeWarehouse(
  value: PurchaseInventoryWarehouseReference,
  field: string,
): PurchaseInventoryWarehouseReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, field);
  }
  const warehouseId = required(value.warehouseId, `${field}.warehouseId`);
  const zoneId = value.zoneId == null ? null : required(value.zoneId, `${field}.zoneId`);
  const locationId = value.locationId == null ? null : required(value.locationId, `${field}.locationId`);
  if (locationId !== null && zoneId === null) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, `${field}.zoneId`);
  }
  return Object.freeze({ warehouseId, zoneId, locationId });
}

export function buildPurchaseInventoryReceiptRequest(
  input: BuildPurchaseInventoryReceiptRequestInput,
): PurchaseInventoryReceiptStageRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "input");
  }
  const purchase = input.purchase;
  if (!purchase || typeof purchase !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "purchase");
  }
  if (purchase.status !== "confirmed") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptIneligible, "purchase.status");
  }
  if (purchase.documentType !== "purchase-order" && purchase.documentType !== "supplier-invoice") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptIneligible, "purchase.documentType");
  }
  if (!Array.isArray(input.commercialFacts) || !Array.isArray(input.allocations) || input.allocations.length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "allocations");
  }

  const facts = new Map<string, PurchaseCommercialTerms>();
  for (const fact of input.commercialFacts) {
    const lineId = required(fact.purchaseLineId, "commercialFacts.purchaseLineId");
    if (facts.has(lineId)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptDuplicateLine, "commercialFacts.purchaseLineId");
    }
    if (!fact.commercialTerms || typeof fact.commercialTerms !== "object") {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "commercialFacts.commercialTerms");
    }
    facts.set(lineId, fact.commercialTerms);
  }

  const allocatedLineIds = new Set<string>();
  const lines: PurchaseInventoryReceiptStageLine[] = [];
  for (let index = 0; index < input.allocations.length; index += 1) {
    const allocation = input.allocations[index];
    if (!allocation || typeof allocation !== "object") {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, `allocations[${index}]`);
    }
    const purchaseLineId = required(allocation.purchaseLineId, `allocations[${index}].purchaseLineId`);
    if (allocatedLineIds.has(purchaseLineId)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptDuplicateLine, "allocations.purchaseLineId");
    }
    allocatedLineIds.add(purchaseLineId);

    const purchaseLine = purchase.lines.find(line => line.lineId === purchaseLineId);
    if (!purchaseLine || purchaseLine.lineKind !== "stock-product" || purchaseLine.itemType !== "product" || !purchaseLine.itemSnapshot.stockTracking) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptIneligible, `allocations[${index}].purchaseLineId`);
    }
    const commercialTerms = facts.get(purchaseLineId);
    if (!commercialTerms) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, `allocations[${index}].commercialTerms`);
    }

    const requested = parsePositiveQuantity(allocation.baseQuantity, `allocations[${index}].baseQuantity`);
    const available = parsePositiveQuantity(commercialTerms.quantity.baseQuantity, `commercialFacts[${index}].commercialTerms.quantity.baseQuantity`);
    if (compareDecimal(requested.decimal, available.decimal) > 0) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptQuantityExceeded, `allocations[${index}].baseQuantity`);
    }

    lines.push(Object.freeze({
      sourceLineId: purchaseLine.lineId,
      productId: purchaseLine.itemId,
      enteredQuantity: requested.canonical,
      unitId: required(commercialTerms.quantity.baseUnit.unitId, `commercialFacts[${index}].commercialTerms.quantity.baseUnit.unitId`),
      warehouse: normalizeWarehouse(allocation.warehouse, `allocations[${index}].warehouse`),
      description: optionalText(allocation.description ?? purchaseLine.description, `allocations[${index}].description`),
    }));
  }

  return Object.freeze({
    companyId: required(purchase.companyId, "purchase.companyId"),
    inventoryDocumentId: required(input.inventoryDocumentId, "inventoryDocumentId"),
    documentType: "receipt",
    businessDate: purchase.businessDate,
    sourceSystem: "purchase",
    sourceDocumentType: purchase.documentType,
    sourceDocumentId: required(purchase.documentId, "purchase.documentId"),
    description: purchase.description,
    lines: Object.freeze(lines),
    requestKey: required(input.requestKey, "requestKey"),
    payloadFingerprint: required(input.payloadFingerprint, "payloadFingerprint"),
  });
}

export async function stagePurchaseInventoryReceipt(
  port: PurchaseInventoryReceiptPort,
  input: BuildPurchaseInventoryReceiptRequestInput,
): Promise<PurchaseInventoryReceiptStageResult> {
  if (!port || typeof port.stageDraft !== "function") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "port");
  }
  const request = buildPurchaseInventoryReceiptRequest(input);
  const result = await port.stageDraft(request);
  if (!result || result.inventoryDocumentId !== request.inventoryDocumentId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "result.inventoryDocumentId");
  }
  if (!Number.isSafeInteger(result.version) || result.version < 1) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptInvalid, "result.version");
  }
  return Object.freeze({
    inventoryDocumentId: result.inventoryDocumentId,
    status: result.status,
    version: result.version,
  });
}
