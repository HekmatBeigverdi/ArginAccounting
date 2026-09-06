import type { WarehouseKind, WarehouseStatus } from "../../domain/warehouse-lifecycle.ts";
import type { WarehouseOrganizationalScope } from "../../domain/warehouse-organization.ts";
import type { WarehouseExternalIdentifier } from "../../domain/warehouse-identifiers.ts";

export const WAREHOUSE_SYNC_CHANGE_KINDS = ["upsert", "tombstone"] as const;
export type WarehouseSyncChangeKind = (typeof WAREHOUSE_SYNC_CHANGE_KINDS)[number];

export interface WarehouseSyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export interface WarehouseSyncExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export interface WarehouseSyncEntityReference {
  readonly companyId: string;
  readonly warehouseId: string;
  readonly displayCode: string;
}

export interface WarehouseSyncSnapshot {
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: WarehouseKind;
  readonly status: WarehouseStatus;
  readonly organizationalScope: WarehouseOrganizationalScope;
  readonly externalIdentifiers: readonly WarehouseExternalIdentifier[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface WarehouseSyncEnvelopeBase {
  readonly entity: "warehouse";
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly reference: Readonly<WarehouseSyncEntityReference>;
  readonly version: number;
  readonly serverRevision: number | null;
  readonly changedAt: string;
  readonly origin: Readonly<WarehouseSyncOrigin>;
  readonly externalReferences: readonly Readonly<WarehouseSyncExternalReference>[];
}

export interface WarehouseSyncUpsertEnvelope extends WarehouseSyncEnvelopeBase {
  readonly changeKind: "upsert";
  readonly deletedAt: null;
  readonly snapshot: Readonly<WarehouseSyncSnapshot>;
}

export interface WarehouseSyncTombstoneEnvelope extends WarehouseSyncEnvelopeBase {
  readonly changeKind: "tombstone";
  readonly deletedAt: string;
  readonly snapshot: null;
}

export type WarehouseSyncChangeEnvelope =
  | WarehouseSyncUpsertEnvelope
  | WarehouseSyncTombstoneEnvelope;

interface WarehouseSyncEnvelopeInputBase {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly reference: WarehouseSyncEntityReference;
  readonly version: number;
  readonly serverRevision?: number | null;
  readonly changedAt: string;
  readonly origin: WarehouseSyncOrigin;
  readonly externalReferences?: readonly WarehouseSyncExternalReference[];
}

export interface CreateWarehouseSyncUpsertInput extends WarehouseSyncEnvelopeInputBase {
  readonly snapshot: WarehouseSyncSnapshot;
}

export interface CreateWarehouseSyncTombstoneInput extends WarehouseSyncEnvelopeInputBase {
  readonly deletedAt: string;
}

export type WarehouseSyncContractErrorCode =
  | "warehouse.sync.operation-id.required"
  | "warehouse.sync.request-id.required"
  | "warehouse.sync.idempotency-key.required"
  | "warehouse.sync.reference.invalid"
  | "warehouse.sync.version.invalid"
  | "warehouse.sync.server-revision.invalid"
  | "warehouse.sync.timestamp.invalid"
  | "warehouse.sync.origin.invalid"
  | "warehouse.sync.snapshot.mismatch"
  | "warehouse.sync.external-reference.invalid"
  | "warehouse.sync.external-reference.duplicate";

export class WarehouseSyncContractError extends Error {
  constructor(public readonly code: WarehouseSyncContractErrorCode) {
    super(code);
    this.name = "WarehouseSyncContractError";
  }
}

const requireText = (value: string, code: WarehouseSyncContractErrorCode): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized) {
    throw new WarehouseSyncContractError(code);
  }
  return normalized;
};

const requireTimestamp = (value: string): string => {
  const normalized = value.trim();
  const parsed = Date.parse(normalized);
  if (!normalized || !Number.isFinite(parsed)) {
    throw new WarehouseSyncContractError("warehouse.sync.timestamp.invalid");
  }
  return new Date(parsed).toISOString();
};

const normalizeReference = (
  reference: WarehouseSyncEntityReference,
): Readonly<WarehouseSyncEntityReference> => {
  const companyId = reference.companyId.trim();
  const warehouseId = reference.warehouseId.trim();
  const displayCode = reference.displayCode.trim();
  if (!companyId || !warehouseId || !displayCode) {
    throw new WarehouseSyncContractError("warehouse.sync.reference.invalid");
  }
  return Object.freeze({ companyId, warehouseId, displayCode });
};

const normalizeOrigin = (origin: WarehouseSyncOrigin): Readonly<WarehouseSyncOrigin> => {
  const sourceSystem = origin.sourceSystem.trim();
  const sourceInstanceId = origin.sourceInstanceId?.trim() || null;
  if (!sourceSystem) {
    throw new WarehouseSyncContractError("warehouse.sync.origin.invalid");
  }
  return Object.freeze({ sourceSystem, sourceInstanceId });
};

const normalizeExternalReferences = (
  references: readonly WarehouseSyncExternalReference[],
): readonly Readonly<WarehouseSyncExternalReference>[] => {
  const result: Readonly<WarehouseSyncExternalReference>[] = [];
  const seen = new Set<string>();
  for (const item of references) {
    const sourceSystem = item.sourceSystem.trim();
    const externalId = item.externalId.trim();
    if (!sourceSystem || !externalId) {
      throw new WarehouseSyncContractError(
        "warehouse.sync.external-reference.invalid",
      );
    }
    const key = `${sourceSystem.toUpperCase()}\u0000${externalId}`;
    if (seen.has(key)) {
      throw new WarehouseSyncContractError(
        "warehouse.sync.external-reference.duplicate",
      );
    }
    seen.add(key);
    result.push(Object.freeze({ sourceSystem, externalId }));
  }
  return Object.freeze(result);
};

const normalizeBase = (input: WarehouseSyncEnvelopeInputBase) => {
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new WarehouseSyncContractError("warehouse.sync.version.invalid");
  }
  const serverRevision = input.serverRevision ?? null;
  if (
    serverRevision !== null &&
    (!Number.isSafeInteger(serverRevision) || serverRevision < 1)
  ) {
    throw new WarehouseSyncContractError(
      "warehouse.sync.server-revision.invalid",
    );
  }
  return Object.freeze({
    operationId: requireText(
      input.operationId,
      "warehouse.sync.operation-id.required",
    ),
    requestId: requireText(input.requestId, "warehouse.sync.request-id.required"),
    idempotencyKey: requireText(
      input.idempotencyKey,
      "warehouse.sync.idempotency-key.required",
    ),
    reference: normalizeReference(input.reference),
    version: input.version,
    serverRevision,
    changedAt: requireTimestamp(input.changedAt),
    origin: normalizeOrigin(input.origin),
    externalReferences: normalizeExternalReferences(input.externalReferences ?? []),
  });
};

export const createWarehouseSyncUpsertEnvelope = (
  input: CreateWarehouseSyncUpsertInput,
): Readonly<WarehouseSyncUpsertEnvelope> => {
  const base = normalizeBase(input);
  if (
    input.snapshot.warehouseId !== base.reference.warehouseId ||
    input.snapshot.companyId !== base.reference.companyId ||
    input.snapshot.code !== base.reference.displayCode
  ) {
    throw new WarehouseSyncContractError("warehouse.sync.snapshot.mismatch");
  }
  return Object.freeze({
    ...base,
    entity: "warehouse",
    changeKind: "upsert",
    deletedAt: null,
    snapshot: Object.freeze({
      ...input.snapshot,
      externalIdentifiers: Object.freeze([...input.snapshot.externalIdentifiers]),
    }),
  });
};

export const createWarehouseSyncTombstoneEnvelope = (
  input: CreateWarehouseSyncTombstoneInput,
): Readonly<WarehouseSyncTombstoneEnvelope> => {
  const base = normalizeBase(input);
  const deletedAt = requireTimestamp(input.deletedAt);
  if (Date.parse(deletedAt) > Date.parse(base.changedAt)) {
    throw new WarehouseSyncContractError("warehouse.sync.timestamp.invalid");
  }
  return Object.freeze({
    ...base,
    entity: "warehouse",
    changeKind: "tombstone",
    deletedAt,
    snapshot: null,
  });
};
