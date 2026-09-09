import {
  addInventoryStockQuantities,
  serializeInventoryStockKey,
  type InventoryStockMovementSnapshot,
} from "../../domain/inventory-stock.ts";
import {
  rehydrateInventoryDocument,
  type InventoryDocumentSnapshot,
  type InventoryDocumentStatus,
} from "../../domain/inventory-document.ts";

export const INVENTORY_SYNC_CONTRACT_VERSION = 1 as const;
export const INVENTORY_SYNC_CHANGE_KINDS = Object.freeze(["upsert", "tombstone", "movement-batch"] as const);
export const INVENTORY_MOVEMENT_BATCH_KINDS = Object.freeze(["confirmation", "transfer", "reversal"] as const);

export type InventorySyncChangeKind = (typeof INVENTORY_SYNC_CHANGE_KINDS)[number];
export type InventoryMovementBatchKind = (typeof INVENTORY_MOVEMENT_BATCH_KINDS)[number];

export interface InventorySyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export interface InventorySyncExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export interface InventorySyncDocumentReference {
  readonly companyId: string;
  readonly documentId: string;
  readonly documentNumber: string | null;
}

export type InventorySyncDependency =
  | Readonly<{ entity: "inventory-document"; id: string }>
  | Readonly<{ entity: "inventory-movement"; id: string }>;

interface InventorySyncMetadataInput {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly changedAt: string;
  readonly origin: InventorySyncOrigin;
  readonly serverRevision?: number | null;
  readonly externalReferences?: readonly InventorySyncExternalReference[];
}

interface InventorySyncMetadata {
  readonly contractVersion: typeof INVENTORY_SYNC_CONTRACT_VERSION;
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly changedAt: string;
  readonly origin: Readonly<InventorySyncOrigin>;
  readonly serverRevision: number | null;
  readonly externalReferences: readonly Readonly<InventorySyncExternalReference>[];
}

interface InventoryDocumentEnvelopeBase extends InventorySyncMetadata {
  readonly entity: "inventory-document";
  readonly reference: Readonly<InventorySyncDocumentReference>;
  readonly localVersion: number;
}

export interface InventoryDocumentSyncUpsertEnvelope extends InventoryDocumentEnvelopeBase {
  readonly changeKind: "upsert";
  readonly deletedAt: null;
  readonly snapshot: Readonly<InventoryDocumentSnapshot>;
}

export interface InventoryDocumentSyncTombstoneEnvelope extends InventoryDocumentEnvelopeBase {
  readonly changeKind: "tombstone";
  readonly deletedAt: string;
  readonly lastKnownStatus: "draft";
  readonly snapshot: null;
}

export type InventoryDocumentSyncEnvelope =
  | InventoryDocumentSyncUpsertEnvelope
  | InventoryDocumentSyncTombstoneEnvelope;

export interface InventoryMovementBatchSyncEnvelope extends InventorySyncMetadata {
  readonly entity: "inventory-movement-batch";
  readonly changeKind: "movement-batch";
  readonly batchId: string;
  readonly batchKind: InventoryMovementBatchKind;
  /** Lifecycle aggregate whose action produced this immutable batch. */
  readonly ownerDocumentId: string;
  /** documentId carried by every movement fact; reversal may differ from ownerDocumentId. */
  readonly effectDocumentId: string;
  /** Local optimistic version of the owning document after the successful mutation. */
  readonly localVersion: number;
  readonly companyId: string;
  readonly movements: readonly Readonly<InventoryStockMovementSnapshot>[];
  readonly dependencies: readonly InventorySyncDependency[];
}

export interface CreateInventoryDocumentSyncUpsertInput extends InventorySyncMetadataInput {
  readonly reference: InventorySyncDocumentReference;
  readonly snapshot: InventoryDocumentSnapshot;
}

export interface CreateInventoryDocumentSyncTombstoneInput extends InventorySyncMetadataInput {
  readonly reference: InventorySyncDocumentReference;
  readonly localVersion: number;
  readonly lastKnownStatus: InventoryDocumentStatus;
  readonly deletedAt: string;
}

export interface CreateInventoryMovementBatchSyncInput extends InventorySyncMetadataInput {
  readonly batchId: string;
  readonly batchKind: InventoryMovementBatchKind;
  readonly ownerDocumentId: string;
  readonly effectDocumentId: string;
  readonly localVersion: number;
  readonly companyId: string;
  readonly movements: readonly InventoryStockMovementSnapshot[];
}

export type InventorySyncContractErrorCode =
  | "inventory.sync.text-required"
  | "inventory.sync.timestamp-invalid"
  | "inventory.sync.version-invalid"
  | "inventory.sync.server-revision-invalid"
  | "inventory.sync.reference-invalid"
  | "inventory.sync.snapshot-mismatch"
  | "inventory.sync.tombstone-invalid"
  | "inventory.sync.external-reference-invalid"
  | "inventory.sync.external-reference-duplicate"
  | "inventory.sync.batch-empty"
  | "inventory.sync.batch-identity-invalid"
  | "inventory.sync.batch-duplicate-movement"
  | "inventory.sync.batch-kind-invalid"
  | "inventory.sync.transfer-incomplete"
  | "inventory.sync.transfer-conservation-invalid"
  | "inventory.sync.reversal-incomplete";

export class InventorySyncContractError extends Error {
  constructor(public readonly code: InventorySyncContractErrorCode) {
    super(code);
    this.name = "InventorySyncContractError";
  }
}

const fail = (code: InventorySyncContractErrorCode): never => {
  throw new InventorySyncContractError(code);
};

const text = (value: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("inventory.sync.text-required");
  return value.trim();
};

const timestamp = (value: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("inventory.sync.timestamp-invalid");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fail("inventory.sync.timestamp-invalid");
  return new Date(parsed).toISOString();
};

const positiveVersion = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) return fail("inventory.sync.version-invalid");
  return value;
};

const normalizeOrigin = (origin: InventorySyncOrigin): Readonly<InventorySyncOrigin> => {
  if (!origin || typeof origin !== "object") return fail("inventory.sync.text-required");
  return Object.freeze({
    sourceSystem: text(origin.sourceSystem),
    sourceInstanceId: origin.sourceInstanceId == null ? null : text(origin.sourceInstanceId),
  });
};

const normalizeExternalReferences = (
  references: readonly InventorySyncExternalReference[],
): readonly Readonly<InventorySyncExternalReference>[] => {
  if (!Array.isArray(references)) return fail("inventory.sync.external-reference-invalid");
  const result: Readonly<InventorySyncExternalReference>[] = [];
  const seen = new Set<string>();
  for (const item of references) {
    if (!item || typeof item !== "object") return fail("inventory.sync.external-reference-invalid");
    const sourceSystem = text(item.sourceSystem);
    const externalId = text(item.externalId);
    const key = `${sourceSystem.toUpperCase()}\u0000${externalId}`;
    if (seen.has(key)) return fail("inventory.sync.external-reference-duplicate");
    seen.add(key);
    result.push(Object.freeze({ sourceSystem, externalId }));
  }
  return Object.freeze(result);
};

const normalizeMetadata = (input: InventorySyncMetadataInput): InventorySyncMetadata => {
  const serverRevision = input.serverRevision ?? null;
  if (serverRevision !== null && (!Number.isSafeInteger(serverRevision) || serverRevision < 1)) {
    return fail("inventory.sync.server-revision-invalid");
  }
  return Object.freeze({
    contractVersion: INVENTORY_SYNC_CONTRACT_VERSION,
    operationId: text(input.operationId),
    requestId: text(input.requestId),
    idempotencyKey: text(input.idempotencyKey),
    payloadFingerprint: text(input.payloadFingerprint),
    changedAt: timestamp(input.changedAt),
    origin: normalizeOrigin(input.origin),
    serverRevision,
    externalReferences: normalizeExternalReferences(input.externalReferences ?? []),
  });
};

const normalizeReference = (
  reference: InventorySyncDocumentReference,
): Readonly<InventorySyncDocumentReference> => {
  if (!reference || typeof reference !== "object") return fail("inventory.sync.reference-invalid");
  return Object.freeze({
    companyId: text(reference.companyId),
    documentId: text(reference.documentId),
    documentNumber: reference.documentNumber == null ? null : text(reference.documentNumber),
  });
};

export function createInventoryDocumentSyncUpsertEnvelope(
  input: CreateInventoryDocumentSyncUpsertInput,
): Readonly<InventoryDocumentSyncUpsertEnvelope> {
  const metadata = normalizeMetadata(input);
  const reference = normalizeReference(input.reference);
  const snapshot = rehydrateInventoryDocument(input.snapshot);
  if (
    snapshot.companyId !== reference.companyId ||
    snapshot.documentId !== reference.documentId ||
    snapshot.documentNumber !== reference.documentNumber
  ) {
    return fail("inventory.sync.snapshot-mismatch");
  }
  if (Date.parse(snapshot.updatedAt) > Date.parse(metadata.changedAt)) {
    return fail("inventory.sync.timestamp-invalid");
  }
  return Object.freeze({
    ...metadata,
    entity: "inventory-document",
    changeKind: "upsert",
    reference,
    localVersion: positiveVersion(snapshot.version),
    deletedAt: null,
    snapshot,
  });
}

export function createInventoryDocumentSyncTombstoneEnvelope(
  input: CreateInventoryDocumentSyncTombstoneInput,
): Readonly<InventoryDocumentSyncTombstoneEnvelope> {
  const metadata = normalizeMetadata(input);
  const reference = normalizeReference(input.reference);
  const deletedAt = timestamp(input.deletedAt);
  if (input.lastKnownStatus !== "draft" || Date.parse(deletedAt) > Date.parse(metadata.changedAt)) {
    return fail("inventory.sync.tombstone-invalid");
  }
  return Object.freeze({
    ...metadata,
    entity: "inventory-document",
    changeKind: "tombstone",
    reference,
    localVersion: positiveVersion(input.localVersion),
    deletedAt,
    lastKnownStatus: "draft",
    snapshot: null,
  });
}

function freezeMovement(movement: InventoryStockMovementSnapshot): Readonly<InventoryStockMovementSnapshot> {
  return Object.freeze({
    ...movement,
    stockKey: Object.freeze({ ...movement.stockKey }),
  });
}

function assertTransferBatch(batchId: string, movements: readonly InventoryStockMovementSnapshot[]): void {
  const byLine = new Map<string, InventoryStockMovementSnapshot[]>();
  for (const movement of movements) {
    if (movement.transferId !== batchId || movement.reversalOfMovementId !== null) {
      return fail("inventory.sync.transfer-incomplete");
    }
    const list = byLine.get(movement.lineId) ?? [];
    list.push(movement);
    byLine.set(movement.lineId, list);
  }
  for (const list of byLine.values()) {
    if (list.length !== 2) return fail("inventory.sync.transfer-incomplete");
    const first = list[0];
    const second = list[1];
    if (!first || !second) return fail("inventory.sync.transfer-incomplete");
    if (serializeInventoryStockKey(first.stockKey) === serializeInventoryStockKey(second.stockKey)) {
      return fail("inventory.sync.transfer-incomplete");
    }
    if (addInventoryStockQuantities(first.quantityDelta, second.quantityDelta) !== "0") {
      return fail("inventory.sync.transfer-conservation-invalid");
    }
  }
}

function assertReversalBatch(
  ownerDocumentId: string,
  effectDocumentId: string,
  movements: readonly InventoryStockMovementSnapshot[],
): void {
  if (ownerDocumentId === effectDocumentId) return fail("inventory.sync.reversal-incomplete");
  const originals = new Set<string>();
  for (const movement of movements) {
    if (movement.transferId !== null || movement.reversalOfMovementId === null) {
      return fail("inventory.sync.reversal-incomplete");
    }
    if (originals.has(movement.reversalOfMovementId)) return fail("inventory.sync.reversal-incomplete");
    originals.add(movement.reversalOfMovementId);
  }
}

function dependenciesForBatch(
  ownerDocumentId: string,
  batchKind: InventoryMovementBatchKind,
  movements: readonly InventoryStockMovementSnapshot[],
): readonly InventorySyncDependency[] {
  const dependencies: InventorySyncDependency[] = [Object.freeze({ entity: "inventory-document", id: ownerDocumentId })];
  if (batchKind === "reversal") {
    for (const movement of movements) {
      if (movement.reversalOfMovementId) {
        dependencies.push(Object.freeze({ entity: "inventory-movement", id: movement.reversalOfMovementId }));
      }
    }
  }
  return Object.freeze(dependencies);
}

export function createInventoryMovementBatchSyncEnvelope(
  input: CreateInventoryMovementBatchSyncInput,
): Readonly<InventoryMovementBatchSyncEnvelope> {
  const metadata = normalizeMetadata(input);
  const batchId = text(input.batchId);
  const ownerDocumentId = text(input.ownerDocumentId);
  const effectDocumentId = text(input.effectDocumentId);
  const companyId = text(input.companyId);
  if (!INVENTORY_MOVEMENT_BATCH_KINDS.includes(input.batchKind)) return fail("inventory.sync.batch-kind-invalid");
  if (!Array.isArray(input.movements) || input.movements.length === 0) return fail("inventory.sync.batch-empty");

  const movementIds = new Set<string>();
  const movements = input.movements.map(movement => {
    if (!movement || typeof movement !== "object") return fail("inventory.sync.batch-identity-invalid");
    if (movement.companyId !== companyId || movement.documentId !== effectDocumentId) {
      return fail("inventory.sync.batch-identity-invalid");
    }
    if (movementIds.has(movement.movementId)) return fail("inventory.sync.batch-duplicate-movement");
    movementIds.add(movement.movementId);
    if (Date.parse(movement.recordedAt) > Date.parse(metadata.changedAt)) {
      return fail("inventory.sync.timestamp-invalid");
    }
    return freezeMovement(movement);
  });

  if (input.batchKind === "transfer") {
    if (ownerDocumentId !== effectDocumentId || batchId === effectDocumentId) {
      return fail("inventory.sync.transfer-incomplete");
    }
    assertTransferBatch(batchId, movements);
  } else if (input.batchKind === "reversal") {
    if (batchId !== effectDocumentId) return fail("inventory.sync.reversal-incomplete");
    assertReversalBatch(ownerDocumentId, effectDocumentId, movements);
  } else {
    if (batchId !== effectDocumentId || ownerDocumentId !== effectDocumentId) {
      return fail("inventory.sync.batch-identity-invalid");
    }
    if (movements.some(movement => movement.transferId !== null || movement.reversalOfMovementId !== null)) {
      return fail("inventory.sync.batch-kind-invalid");
    }
  }

  return Object.freeze({
    ...metadata,
    entity: "inventory-movement-batch",
    changeKind: "movement-batch",
    batchId,
    batchKind: input.batchKind,
    ownerDocumentId,
    effectDocumentId,
    localVersion: positiveVersion(input.localVersion),
    companyId,
    movements: Object.freeze(movements),
    dependencies: dependenciesForBatch(ownerDocumentId, input.batchKind, movements),
  });
}
