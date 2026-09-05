import type { WarehouseLocationSnapshot, WarehouseZoneSnapshot } from "../../domain/warehouse-physical-structure.ts";

export type WarehousePhysicalSyncEntityType = "warehouse-zone" | "warehouse-location";
export type WarehousePhysicalSyncChangeKind = "upsert" | "tombstone";

export interface WarehousePhysicalSyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export interface WarehousePhysicalSyncEntityReference {
  readonly companyId: string;
  readonly warehouseId: string;
  readonly entityType: WarehousePhysicalSyncEntityType;
  readonly entityId: string;
}

export interface WarehousePhysicalSyncEnvelopeBase {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly changedAt: string;
  readonly origin: WarehousePhysicalSyncOrigin;
  readonly entity: WarehousePhysicalSyncEntityReference;
}

export interface WarehousePhysicalSyncUpsertEnvelope extends WarehousePhysicalSyncEnvelopeBase {
  readonly changeKind: "upsert";
  readonly snapshot: WarehouseZoneSnapshot | WarehouseLocationSnapshot;
}

export interface WarehousePhysicalSyncTombstoneEnvelope extends WarehousePhysicalSyncEnvelopeBase {
  readonly changeKind: "tombstone";
  readonly snapshot: null;
  readonly deletedAt: string;
}

export type WarehousePhysicalSyncEnvelope =
  | WarehousePhysicalSyncUpsertEnvelope
  | WarehousePhysicalSyncTombstoneEnvelope;

/**
 * Phase 19 only freezes the transport-neutral change envelope. The actual
 * outbox/change-feed transport, server acknowledgement, retry scheduling and
 * conflict resolution remain owned by the future synchronization phase.
 */
export const createWarehousePhysicalUpsertEnvelope = (input: Omit<WarehousePhysicalSyncUpsertEnvelope, "changeKind">): WarehousePhysicalSyncUpsertEnvelope =>
  Object.freeze({ ...input, changeKind: "upsert" as const });

export const createWarehousePhysicalTombstoneEnvelope = (input: Omit<WarehousePhysicalSyncTombstoneEnvelope, "changeKind" | "snapshot">): WarehousePhysicalSyncTombstoneEnvelope =>
  Object.freeze({ ...input, changeKind: "tombstone" as const, snapshot: null });
