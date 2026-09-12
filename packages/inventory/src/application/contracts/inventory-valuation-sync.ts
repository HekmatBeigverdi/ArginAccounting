import type { InventoryResolvedInboundCostBasis } from "../../domain/inventory-inbound-cost.ts";
import type { InventoryValuationPolicySnapshot } from "../../domain/inventory-valuation-policy.ts";

export const INVENTORY_VALUATION_SYNC_CONTRACT_VERSION = 1 as const;

export const INVENTORY_VALUATION_SYNC_ENTITY_KINDS = Object.freeze([
  "valuation-policy",
  "valuation-cost-input",
] as const);

export type InventoryValuationSyncEntityKind = (typeof INVENTORY_VALUATION_SYNC_ENTITY_KINDS)[number];

export interface InventoryValuationSyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export interface InventoryValuationSyncExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export type InventoryValuationSyncDependency =
  | Readonly<{ entity: "inventory-movement"; id: string }>
  | Readonly<{ entity: "valuation-policy"; id: string }>;

interface InventoryValuationSyncMetadataInput {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly changedAt: string;
  readonly origin: InventoryValuationSyncOrigin;
  readonly streamKey: string;
  readonly streamRevision: number;
  readonly serverRevision?: number | null;
  readonly externalReferences?: readonly InventoryValuationSyncExternalReference[];
}

interface InventoryValuationSyncMetadata {
  readonly contractVersion: typeof INVENTORY_VALUATION_SYNC_CONTRACT_VERSION;
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly changedAt: string;
  readonly origin: Readonly<InventoryValuationSyncOrigin>;
  readonly streamKey: string;
  readonly streamRevision: number;
  readonly serverRevision: number | null;
  readonly externalReferences: readonly Readonly<InventoryValuationSyncExternalReference>[];
}

export interface InventoryValuationPolicySyncEnvelope extends InventoryValuationSyncMetadata {
  readonly entity: "valuation-policy";
  readonly changeKind: "append";
  readonly companyId: string;
  readonly policyId: string;
  readonly snapshot: Readonly<InventoryValuationPolicySnapshot>;
  readonly dependencies: readonly InventoryValuationSyncDependency[];
}

export interface InventoryValuationCostInputSyncEnvelope extends InventoryValuationSyncMetadata {
  readonly entity: "valuation-cost-input";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly basisLineId: string;
  readonly movementId: string;
  readonly revision: number;
  readonly snapshot: Readonly<InventoryResolvedInboundCostBasis>;
  readonly dependencies: readonly InventoryValuationSyncDependency[];
}

export type InventoryValuationSyncEnvelope =
  | InventoryValuationPolicySyncEnvelope
  | InventoryValuationCostInputSyncEnvelope;

export interface CreateInventoryValuationPolicySyncInput extends InventoryValuationSyncMetadataInput {
  readonly snapshot: InventoryValuationPolicySnapshot;
}

export interface CreateInventoryValuationCostInputSyncInput extends InventoryValuationSyncMetadataInput {
  readonly companyId: string;
  readonly revision: number;
  readonly snapshot: InventoryResolvedInboundCostBasis;
}

export type InventoryValuationSyncContractErrorCode =
  | "valuation.sync.text-required"
  | "valuation.sync.timestamp-invalid"
  | "valuation.sync.revision-invalid"
  | "valuation.sync.server-revision-invalid"
  | "valuation.sync.snapshot-mismatch"
  | "valuation.sync.external-reference-invalid"
  | "valuation.sync.external-reference-duplicate";

export class InventoryValuationSyncContractError extends Error {
  constructor(public readonly code: InventoryValuationSyncContractErrorCode) {
    super(code);
    this.name = "InventoryValuationSyncContractError";
  }
}

const fail = (code: InventoryValuationSyncContractErrorCode): never => {
  throw new InventoryValuationSyncContractError(code);
};

const text = (value: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("valuation.sync.text-required");
  return value.trim();
};

const timestamp = (value: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("valuation.sync.timestamp-invalid");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fail("valuation.sync.timestamp-invalid");
  return new Date(parsed).toISOString();
};

const positiveRevision = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) return fail("valuation.sync.revision-invalid");
  return value;
};

const normalizeOrigin = (origin: InventoryValuationSyncOrigin): Readonly<InventoryValuationSyncOrigin> => {
  if (!origin || typeof origin !== "object") return fail("valuation.sync.text-required");
  return Object.freeze({
    sourceSystem: text(origin.sourceSystem),
    sourceInstanceId: origin.sourceInstanceId == null ? null : text(origin.sourceInstanceId),
  });
};

const normalizeExternalReferences = (
  references: readonly InventoryValuationSyncExternalReference[],
): readonly Readonly<InventoryValuationSyncExternalReference>[] => {
  if (!Array.isArray(references)) return fail("valuation.sync.external-reference-invalid");
  const result: Readonly<InventoryValuationSyncExternalReference>[] = [];
  const seen = new Set<string>();
  for (const item of references) {
    if (!item || typeof item !== "object") return fail("valuation.sync.external-reference-invalid");
    const sourceSystem = text(item.sourceSystem);
    const externalId = text(item.externalId);
    const key = `${sourceSystem.toUpperCase()}\u0000${externalId}`;
    if (seen.has(key)) return fail("valuation.sync.external-reference-duplicate");
    seen.add(key);
    result.push(Object.freeze({ sourceSystem, externalId }));
  }
  return Object.freeze(result);
};

const normalizeMetadata = (input: InventoryValuationSyncMetadataInput): InventoryValuationSyncMetadata => {
  const serverRevision = input.serverRevision ?? null;
  if (serverRevision !== null && (!Number.isSafeInteger(serverRevision) || serverRevision < 1)) {
    return fail("valuation.sync.server-revision-invalid");
  }
  return Object.freeze({
    contractVersion: INVENTORY_VALUATION_SYNC_CONTRACT_VERSION,
    operationId: text(input.operationId),
    requestId: text(input.requestId),
    idempotencyKey: text(input.idempotencyKey),
    payloadFingerprint: text(input.payloadFingerprint),
    changedAt: timestamp(input.changedAt),
    origin: normalizeOrigin(input.origin),
    streamKey: text(input.streamKey),
    streamRevision: positiveRevision(input.streamRevision),
    serverRevision,
    externalReferences: normalizeExternalReferences(input.externalReferences ?? []),
  });
};

const freezePolicy = (snapshot: InventoryValuationPolicySnapshot): Readonly<InventoryValuationPolicySnapshot> =>
  Object.freeze({ ...snapshot });

const freezeCostBasis = (snapshot: InventoryResolvedInboundCostBasis): Readonly<InventoryResolvedInboundCostBasis> =>
  Object.freeze({
    ...snapshot,
    allocations: Object.freeze(snapshot.allocations.map(item => Object.freeze({ ...item }))),
  });

export function createInventoryValuationPolicySyncEnvelope(
  input: CreateInventoryValuationPolicySyncInput,
): Readonly<InventoryValuationPolicySyncEnvelope> {
  const metadata = normalizeMetadata(input);
  const snapshot = freezePolicy(input.snapshot);
  if (!snapshot || typeof snapshot !== "object" || snapshot.companyId !== snapshot.companyId.trim()) {
    return fail("valuation.sync.snapshot-mismatch");
  }
  const companyId = text(snapshot.companyId);
  const policyId = text(snapshot.policyId);
  if (metadata.streamKey !== `policy:${companyId}` || metadata.streamRevision !== snapshot.revision) {
    return fail("valuation.sync.snapshot-mismatch");
  }
  if (snapshot.previousPolicyId !== null && !snapshot.previousPolicyId.trim()) return fail("valuation.sync.snapshot-mismatch");
  return Object.freeze({
    ...metadata,
    entity: "valuation-policy",
    changeKind: "append",
    companyId,
    policyId,
    snapshot,
    dependencies: Object.freeze(
      snapshot.previousPolicyId === null
        ? []
        : [Object.freeze({ entity: "valuation-policy" as const, id: snapshot.previousPolicyId })],
    ),
  });
}

export function createInventoryValuationCostInputSyncEnvelope(
  input: CreateInventoryValuationCostInputSyncInput,
): Readonly<InventoryValuationCostInputSyncEnvelope> {
  const metadata = normalizeMetadata(input);
  const companyId = text(input.companyId);
  const snapshot = freezeCostBasis(input.snapshot);
  const basisLineId = text(snapshot.basisLineId);
  const movementId = text(snapshot.movementId);
  const revision = positiveRevision(input.revision);
  if (metadata.streamKey !== `valuation:${companyId}:${text(snapshot.productId)}`) {
    return fail("valuation.sync.snapshot-mismatch");
  }
  return Object.freeze({
    ...metadata,
    entity: "valuation-cost-input",
    changeKind: "upsert",
    companyId,
    basisLineId,
    movementId,
    revision,
    snapshot,
    dependencies: Object.freeze([Object.freeze({ entity: "inventory-movement" as const, id: movementId })]),
  });
}

export const INVENTORY_VALUATION_DERIVED_SYNC_ENTITIES = Object.freeze([
  "valuation-entry",
  "valuation-cost-layer",
  "valuation-state",
] as const);

export type InventoryValuationDerivedSyncEntity = (typeof INVENTORY_VALUATION_DERIVED_SYNC_ENTITIES)[number];

/** Derived valuation projections are never authoritative Bridge payloads. */
export function assertInventoryValuationEntityIsAuthoritativeForSync(entity: string): asserts entity is InventoryValuationSyncEntityKind {
  if (!INVENTORY_VALUATION_SYNC_ENTITY_KINDS.includes(entity as InventoryValuationSyncEntityKind)) {
    return fail("valuation.sync.snapshot-mismatch");
  }
}
