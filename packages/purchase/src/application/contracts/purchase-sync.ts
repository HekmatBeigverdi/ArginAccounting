import {
  rehydratePurchaseDocument,
  type PurchaseDocumentSnapshot,
} from "../../domain/purchase-document.ts";
import type { PurchaseDocumentStatus } from "../../domain/purchase-lifecycle.ts";
import {
  createPurchaseCommercialTerms,
  normalizePurchaseQuantity,
  type PurchaseCommercialTerms,
} from "../../domain/purchase-commercial-semantics.ts";
import type { PurchaseCommercialFactSnapshot } from "./purchase-repository.ts";
import type { PurchaseReceiptInvoiceMatchSnapshot } from "../../domain/purchase-receipt-invoice-matching.ts";
import type { PurchaseInventoryValuationCostInputSnapshot } from "../../domain/purchase-inventory-valuation-cost-input.ts";

export const PURCHASE_SYNC_CONTRACT_VERSION = 1 as const;
export const PURCHASE_SYNC_CHANGE_KINDS = Object.freeze(["upsert", "tombstone"] as const);

export type PurchaseSyncChangeKind = (typeof PURCHASE_SYNC_CHANGE_KINDS)[number];

export interface PurchaseSyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export interface PurchaseSyncExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export type PurchaseSyncDependency =
  | Readonly<{ entity: "branch"; id: string }>
  | Readonly<{ entity: "fiscal-year"; id: string }>
  | Readonly<{ entity: "fiscal-period"; id: string }>
  | Readonly<{ entity: "party"; id: string }>
  | Readonly<{ entity: "product"; id: string }>
  | Readonly<{ entity: "warehouse"; id: string }>
  | Readonly<{ entity: "purchase-document"; id: string }>
  | Readonly<{ entity: "purchase-line"; id: string }>
  | Readonly<{ entity: "purchase-match"; id: string }>
  | Readonly<{ entity: "inventory-document"; id: string }>
  | Readonly<{ entity: "inventory-line"; id: string }>
  | Readonly<{ entity: "inventory-movement"; id: string }>;

interface PurchaseSyncMetadataInput {
  readonly operationId: string;
  readonly requestId: string;
  readonly payloadFingerprint: string;
  readonly changedAt: string;
  readonly origin: PurchaseSyncOrigin;
  readonly serverRevision?: number | null;
  readonly externalReferences?: readonly PurchaseSyncExternalReference[];
}

interface PurchaseSyncMetadata {
  readonly contractVersion: typeof PURCHASE_SYNC_CONTRACT_VERSION;
  readonly operationId: string;
  readonly requestId: string;
  readonly payloadFingerprint: string;
  readonly changedAt: string;
  readonly origin: Readonly<PurchaseSyncOrigin>;
  readonly serverRevision: number | null;
  readonly externalReferences: readonly Readonly<PurchaseSyncExternalReference>[];
}

export interface PurchaseSyncDocumentReference {
  readonly companyId: string;
  readonly branchId: string;
  readonly documentId: string;
  readonly documentNumber: string | null;
}

interface PurchaseDocumentSyncEnvelopeBase extends PurchaseSyncMetadata {
  readonly entity: "purchase-document";
  readonly reference: Readonly<PurchaseSyncDocumentReference>;
  readonly localVersion: number;
  readonly dependencies: readonly PurchaseSyncDependency[];
}

export interface PurchaseDocumentSyncUpsertEnvelope extends PurchaseDocumentSyncEnvelopeBase {
  readonly changeKind: "upsert";
  readonly deletedAt: null;
  readonly snapshot: Readonly<PurchaseDocumentSnapshot>;
}

export interface PurchaseDocumentSyncTombstoneEnvelope extends PurchaseDocumentSyncEnvelopeBase {
  readonly changeKind: "tombstone";
  readonly deletedAt: string;
  readonly lastKnownStatus: "draft";
  readonly snapshot: null;
}

export type PurchaseDocumentSyncEnvelope =
  | PurchaseDocumentSyncUpsertEnvelope
  | PurchaseDocumentSyncTombstoneEnvelope;

export interface PurchaseCommercialFactSyncEnvelope extends PurchaseSyncMetadata {
  readonly entity: "purchase-commercial-fact";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly branchId: string;
  readonly localRevision: number;
  readonly snapshot: Readonly<PurchaseCommercialFactSnapshot>;
  readonly dependencies: readonly PurchaseSyncDependency[];
}

export interface PurchaseReceiptInvoiceMatchSyncEnvelope extends PurchaseSyncMetadata {
  readonly entity: "purchase-receipt-invoice-match";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly branchId: string;
  readonly localRevision: 1;
  readonly snapshot: Readonly<PurchaseReceiptInvoiceMatchSnapshot>;
  readonly dependencies: readonly PurchaseSyncDependency[];
}

export interface PurchaseValuationCostInputSyncEnvelope extends PurchaseSyncMetadata {
  readonly entity: "purchase-valuation-cost-input";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly branchId: string;
  readonly localRevision: number;
  readonly snapshot: Readonly<PurchaseInventoryValuationCostInputSnapshot>;
  readonly dependencies: readonly PurchaseSyncDependency[];
}

export interface CreatePurchaseDocumentSyncUpsertInput extends PurchaseSyncMetadataInput {
  readonly reference: PurchaseSyncDocumentReference;
  readonly snapshot: PurchaseDocumentSnapshot;
}

export interface CreatePurchaseDocumentSyncTombstoneInput extends PurchaseSyncMetadataInput {
  readonly reference: PurchaseSyncDocumentReference;
  readonly localVersion: number;
  readonly lastKnownStatus: PurchaseDocumentStatus;
  readonly deletedAt: string;
}

export interface CreatePurchaseCommercialFactSyncInput extends PurchaseSyncMetadataInput {
  readonly branchId: string;
  readonly snapshot: PurchaseCommercialFactSnapshot;
}

export interface CreatePurchaseReceiptInvoiceMatchSyncInput extends PurchaseSyncMetadataInput {
  readonly branchId: string;
  readonly snapshot: PurchaseReceiptInvoiceMatchSnapshot;
}

export interface CreatePurchaseValuationCostInputSyncInput extends PurchaseSyncMetadataInput {
  readonly branchId: string;
  readonly localRevision: number;
  readonly snapshot: PurchaseInventoryValuationCostInputSnapshot;
}

export type PurchaseSyncContractErrorCode =
  | "purchase.sync.text-required"
  | "purchase.sync.timestamp-invalid"
  | "purchase.sync.version-invalid"
  | "purchase.sync.server-revision-invalid"
  | "purchase.sync.reference-invalid"
  | "purchase.sync.snapshot-mismatch"
  | "purchase.sync.tombstone-invalid"
  | "purchase.sync.external-reference-invalid"
  | "purchase.sync.external-reference-duplicate"
  | "purchase.sync.fact-invalid"
  | "purchase.sync.cost-input-invalid";

export class PurchaseSyncContractError extends Error {
  constructor(public readonly code: PurchaseSyncContractErrorCode) {
    super(code);
    this.name = "PurchaseSyncContractError";
  }
}

const fail = (code: PurchaseSyncContractErrorCode): never => {
  throw new PurchaseSyncContractError(code);
};

const text = (value: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("purchase.sync.text-required");
  return value.trim();
};

const timestamp = (value: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("purchase.sync.timestamp-invalid");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fail("purchase.sync.timestamp-invalid");
  return new Date(parsed).toISOString();
};

const positiveVersion = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) return fail("purchase.sync.version-invalid");
  return value;
};

const normalizeOrigin = (origin: PurchaseSyncOrigin): Readonly<PurchaseSyncOrigin> => {
  if (!origin || typeof origin !== "object") return fail("purchase.sync.text-required");
  return Object.freeze({
    sourceSystem: text(origin.sourceSystem),
    sourceInstanceId: origin.sourceInstanceId == null ? null : text(origin.sourceInstanceId),
  });
};

const normalizeExternalReferences = (
  references: readonly PurchaseSyncExternalReference[],
): readonly Readonly<PurchaseSyncExternalReference>[] => {
  if (!Array.isArray(references)) return fail("purchase.sync.external-reference-invalid");
  const result: Readonly<PurchaseSyncExternalReference>[] = [];
  const seen = new Set<string>();
  for (const item of references) {
    if (!item || typeof item !== "object") return fail("purchase.sync.external-reference-invalid");
    const sourceSystem = text(item.sourceSystem);
    const externalId = text(item.externalId);
    const key = `${sourceSystem.toUpperCase()}\u0000${externalId}`;
    if (seen.has(key)) return fail("purchase.sync.external-reference-duplicate");
    seen.add(key);
    result.push(Object.freeze({ sourceSystem, externalId }));
  }
  return Object.freeze(result);
};

const normalizeMetadata = (input: PurchaseSyncMetadataInput): PurchaseSyncMetadata => {
  const serverRevision = input.serverRevision ?? null;
  if (serverRevision !== null && (!Number.isSafeInteger(serverRevision) || serverRevision < 1)) {
    return fail("purchase.sync.server-revision-invalid");
  }
  return Object.freeze({
    contractVersion: PURCHASE_SYNC_CONTRACT_VERSION,
    operationId: text(input.operationId),
    requestId: text(input.requestId),
    payloadFingerprint: text(input.payloadFingerprint),
    changedAt: timestamp(input.changedAt),
    origin: normalizeOrigin(input.origin),
    serverRevision,
    externalReferences: normalizeExternalReferences(input.externalReferences ?? []),
  });
};

const normalizeReference = (
  reference: PurchaseSyncDocumentReference,
): Readonly<PurchaseSyncDocumentReference> => {
  if (!reference || typeof reference !== "object") return fail("purchase.sync.reference-invalid");
  return Object.freeze({
    companyId: text(reference.companyId),
    branchId: text(reference.branchId),
    documentId: text(reference.documentId),
    documentNumber: reference.documentNumber == null ? null : text(reference.documentNumber),
  });
};

const dependencyKey = (item: PurchaseSyncDependency): string => `${item.entity}\u0000${item.id}`;

const freezeDependencies = (
  items: readonly PurchaseSyncDependency[],
): readonly PurchaseSyncDependency[] => {
  const seen = new Set<string>();
  const result: PurchaseSyncDependency[] = [];
  for (const item of items) {
    const normalized = Object.freeze({ entity: item.entity, id: text(item.id) }) as PurchaseSyncDependency;
    const key = dependencyKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return Object.freeze(result);
};

const documentDependencies = (snapshot: PurchaseDocumentSnapshot): readonly PurchaseSyncDependency[] => {
  const dependencies: PurchaseSyncDependency[] = [
    { entity: "branch", id: snapshot.scope.branchId },
    { entity: "fiscal-year", id: snapshot.scope.fiscalYearId },
    { entity: "fiscal-period", id: snapshot.scope.fiscalPeriodId },
    { entity: "party", id: snapshot.supplierId },
  ];
  for (const line of snapshot.lines) {
    dependencies.push({ entity: "product", id: line.itemId });
  }
  if (snapshot.correctionReference) {
    dependencies.push({ entity: "purchase-document", id: snapshot.correctionReference.documentId });
  }
  return freezeDependencies(dependencies);
};

function normalizeCommercialFact(snapshot: PurchaseCommercialFactSnapshot): Readonly<PurchaseCommercialFactSnapshot> {
  if (!snapshot || typeof snapshot !== "object") return fail("purchase.sync.fact-invalid");
  const companyId = text(snapshot.companyId);
  const purchaseDocumentId = text(snapshot.purchaseDocumentId);
  const purchaseLineId = text(snapshot.purchaseLineId);
  const revision = positiveVersion(snapshot.revision);
  let terms: PurchaseCommercialTerms;
  try {
    terms = createPurchaseCommercialTerms({
      enteredQuantity: snapshot.commercialTerms.quantity.enteredQuantity,
      enteredUnit: snapshot.commercialTerms.quantity.enteredUnit,
      baseUnit: snapshot.commercialTerms.quantity.baseUnit,
      unitPrice: snapshot.commercialTerms.unitPrice,
      discounts: snapshot.commercialTerms.discounts,
      charges: snapshot.commercialTerms.charges,
      tax: snapshot.commercialTerms.tax,
    });
  } catch {
    return fail("purchase.sync.fact-invalid");
  }
  return Object.freeze({
    companyId,
    purchaseDocumentId,
    purchaseLineId,
    commercialTerms: terms,
    revision,
  });
}

function normalizeMatch(snapshot: PurchaseReceiptInvoiceMatchSnapshot): Readonly<PurchaseReceiptInvoiceMatchSnapshot> {
  if (!snapshot || typeof snapshot !== "object") return fail("purchase.sync.fact-invalid");
  let matchedBaseQuantity: string;
  try {
    matchedBaseQuantity = normalizePurchaseQuantity(snapshot.matchedBaseQuantity);
  } catch {
    return fail("purchase.sync.fact-invalid");
  }
  if (matchedBaseQuantity === "0") return fail("purchase.sync.fact-invalid");
  return Object.freeze({
    matchId: text(snapshot.matchId),
    companyId: text(snapshot.companyId),
    invoiceDocumentId: text(snapshot.invoiceDocumentId),
    invoiceLineId: text(snapshot.invoiceLineId),
    receiptDocumentId: text(snapshot.receiptDocumentId),
    receiptLineId: text(snapshot.receiptLineId),
    productId: text(snapshot.productId),
    matchedBaseQuantity,
  });
}

function normalizeCostInput(
  snapshot: PurchaseInventoryValuationCostInputSnapshot,
): Readonly<PurchaseInventoryValuationCostInputSnapshot> {
  if (!snapshot || typeof snapshot !== "object") return fail("purchase.sync.cost-input-invalid");
  const costInputId = text(snapshot.costInputId);
  const companyId = text(snapshot.companyId);
  const movementId = text(snapshot.movementId);
  const receiptDocumentId = text(snapshot.receiptDocumentId);
  const receiptLineId = text(snapshot.receiptLineId);
  const productId = text(snapshot.productId);
  const basis = snapshot.basis;
  if (
    !basis ||
    basis.basisLineId !== costInputId ||
    basis.movementId !== movementId ||
    basis.productId !== productId ||
    !Number.isSafeInteger(basis.baseCost) || basis.baseCost < 0 ||
    !Number.isSafeInteger(basis.landedCost) || basis.landedCost < 0 ||
    !Number.isSafeInteger(basis.totalCost) || basis.totalCost !== basis.baseCost + basis.landedCost ||
    !Array.isArray(basis.allocations) || basis.allocations.length !== 0
  ) {
    return fail("purchase.sync.cost-input-invalid");
  }
  let quantity: string;
  try {
    quantity = normalizePurchaseQuantity(basis.quantity);
  } catch {
    return fail("purchase.sync.cost-input-invalid");
  }
  if (quantity === "0") return fail("purchase.sync.cost-input-invalid");

  if (!Array.isArray(snapshot.sources) || snapshot.sources.length === 0) {
    return fail("purchase.sync.cost-input-invalid");
  }
  const sourceIds = new Set<string>();
  let allocatedBaseCost = 0;
  const sources = snapshot.sources.map(source => {
    if (
      source.productId !== productId ||
      source.receiptDocumentId !== receiptDocumentId ||
      source.receiptLineId !== receiptLineId ||
      !Number.isSafeInteger(source.allocatedBaseCost) ||
      source.allocatedBaseCost < 0
    ) {
      return fail("purchase.sync.cost-input-invalid");
    }
    const matchId = text(source.matchId);
    if (sourceIds.has(matchId)) return fail("purchase.sync.cost-input-invalid");
    sourceIds.add(matchId);
    allocatedBaseCost += source.allocatedBaseCost;
    if (!Number.isSafeInteger(allocatedBaseCost)) return fail("purchase.sync.cost-input-invalid");
    return Object.freeze({
      matchId,
      purchaseDocumentId: text(source.purchaseDocumentId),
      purchaseLineId: text(source.purchaseLineId),
      receiptDocumentId,
      receiptLineId,
      productId,
      matchedBaseQuantity: (() => {
        try {
          const value = normalizePurchaseQuantity(source.matchedBaseQuantity);
          if (value === "0") return fail("purchase.sync.cost-input-invalid");
          return value;
        } catch {
          return fail("purchase.sync.cost-input-invalid");
        }
      })(),
      allocatedBaseCost: source.allocatedBaseCost,
    });
  });

  if (allocatedBaseCost !== basis.baseCost) return fail("purchase.sync.cost-input-invalid");
  const currency = text(basis.currency).toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) return fail("purchase.sync.cost-input-invalid");
  if (!/^\d+(?:\.\d+)?$/u.test(String(basis.unitCost))) return fail("purchase.sync.cost-input-invalid");

  return Object.freeze({
    costInputId,
    companyId,
    movementId,
    receiptDocumentId,
    receiptLineId,
    productId,
    sources: Object.freeze(sources),
    basis: Object.freeze({
      basisLineId: costInputId,
      movementId,
      productId,
      warehouseId: text(basis.warehouseId),
      quantity,
      currency,
      baseCost: basis.baseCost,
      landedCost: basis.landedCost,
      totalCost: basis.totalCost,
      unitCost: text(basis.unitCost),
      allocations: Object.freeze([]) as readonly [],
    }),
  });
}

export function createPurchaseDocumentSyncUpsertEnvelope(
  input: CreatePurchaseDocumentSyncUpsertInput,
): Readonly<PurchaseDocumentSyncUpsertEnvelope> {
  const metadata = normalizeMetadata(input);
  const reference = normalizeReference(input.reference);
  let snapshot: PurchaseDocumentSnapshot;
  try {
    snapshot = rehydratePurchaseDocument(input.snapshot);
  } catch {
    return fail("purchase.sync.snapshot-mismatch");
  }
  if (
    snapshot.companyId !== reference.companyId ||
    snapshot.scope.branchId !== reference.branchId ||
    snapshot.documentId !== reference.documentId ||
    snapshot.documentNumber !== reference.documentNumber
  ) {
    return fail("purchase.sync.snapshot-mismatch");
  }
  if (Date.parse(snapshot.updatedAt) > Date.parse(metadata.changedAt)) {
    return fail("purchase.sync.timestamp-invalid");
  }
  return Object.freeze({
    ...metadata,
    entity: "purchase-document",
    changeKind: "upsert",
    reference,
    localVersion: positiveVersion(snapshot.version),
    dependencies: documentDependencies(snapshot),
    deletedAt: null,
    snapshot,
  });
}

export function createPurchaseDocumentSyncTombstoneEnvelope(
  input: CreatePurchaseDocumentSyncTombstoneInput,
): Readonly<PurchaseDocumentSyncTombstoneEnvelope> {
  const metadata = normalizeMetadata(input);
  const reference = normalizeReference(input.reference);
  const deletedAt = timestamp(input.deletedAt);
  if (input.lastKnownStatus !== "draft" || Date.parse(deletedAt) > Date.parse(metadata.changedAt)) {
    return fail("purchase.sync.tombstone-invalid");
  }
  return Object.freeze({
    ...metadata,
    entity: "purchase-document",
    changeKind: "tombstone",
    reference,
    localVersion: positiveVersion(input.localVersion),
    dependencies: freezeDependencies([{ entity: "branch", id: reference.branchId }]),
    deletedAt,
    lastKnownStatus: "draft",
    snapshot: null,
  });
}

export function createPurchaseCommercialFactSyncEnvelope(
  input: CreatePurchaseCommercialFactSyncInput,
): Readonly<PurchaseCommercialFactSyncEnvelope> {
  const metadata = normalizeMetadata(input);
  const snapshot = normalizeCommercialFact(input.snapshot);
  return Object.freeze({
    ...metadata,
    entity: "purchase-commercial-fact",
    changeKind: "upsert",
    companyId: snapshot.companyId,
    branchId: text(input.branchId),
    localRevision: snapshot.revision,
    snapshot,
    dependencies: freezeDependencies([
      { entity: "purchase-document", id: snapshot.purchaseDocumentId },
      { entity: "purchase-line", id: snapshot.purchaseLineId },
    ]),
  });
}

export function createPurchaseReceiptInvoiceMatchSyncEnvelope(
  input: CreatePurchaseReceiptInvoiceMatchSyncInput,
): Readonly<PurchaseReceiptInvoiceMatchSyncEnvelope> {
  const metadata = normalizeMetadata(input);
  const snapshot = normalizeMatch(input.snapshot);
  return Object.freeze({
    ...metadata,
    entity: "purchase-receipt-invoice-match",
    changeKind: "upsert",
    companyId: snapshot.companyId,
    branchId: text(input.branchId),
    localRevision: 1,
    snapshot,
    dependencies: freezeDependencies([
      { entity: "purchase-document", id: snapshot.invoiceDocumentId },
      { entity: "purchase-line", id: snapshot.invoiceLineId },
      { entity: "inventory-document", id: snapshot.receiptDocumentId },
      { entity: "inventory-line", id: snapshot.receiptLineId },
      { entity: "product", id: snapshot.productId },
    ]),
  });
}

export function createPurchaseValuationCostInputSyncEnvelope(
  input: CreatePurchaseValuationCostInputSyncInput,
): Readonly<PurchaseValuationCostInputSyncEnvelope> {
  const metadata = normalizeMetadata(input);
  const snapshot = normalizeCostInput(input.snapshot);
  const dependencies: PurchaseSyncDependency[] = [
    { entity: "inventory-movement", id: snapshot.movementId },
    { entity: "inventory-document", id: snapshot.receiptDocumentId },
    { entity: "inventory-line", id: snapshot.receiptLineId },
    { entity: "product", id: snapshot.productId },
    { entity: "warehouse", id: snapshot.basis.warehouseId },
  ];
  for (const source of snapshot.sources) {
    dependencies.push(
      { entity: "purchase-match", id: source.matchId },
      { entity: "purchase-document", id: source.purchaseDocumentId },
      { entity: "purchase-line", id: source.purchaseLineId },
    );
  }
  return Object.freeze({
    ...metadata,
    entity: "purchase-valuation-cost-input",
    changeKind: "upsert",
    companyId: snapshot.companyId,
    branchId: text(input.branchId),
    localRevision: positiveVersion(input.localRevision),
    snapshot,
    dependencies: freezeDependencies(dependencies),
  });
}
