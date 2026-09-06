# Warehouse Synchronization Contract

## Status

Phase 19 Step 10 establishes the synchronization-facing contract for Warehouse master data only. It does not implement Argin Bridge transport or the Phase 45 synchronization engine.

## Target Direction

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

## Durable Identity

- `warehouseId` is the durable cross-store Warehouse identity.
- `companyId` is always part of synchronization scope.
- `code` is display/business metadata and never replaces `warehouseId`.
- SQLite row identity must never leak into synchronization contracts.
- Zone and Location retain their own durable IDs, but Step 10 does not silently fold their change lifecycle into the Warehouse version. Independent child synchronization requires a dedicated child change contract when a concrete consumer needs it.

## Change Envelope

Warehouse changes use a discriminated union:

- `upsert` — carries the complete Warehouse master-data snapshot.
- `tombstone` — carries durable identity/version/deletion metadata with `snapshot: null`.

`active`, `inactive`, and `archived` are Warehouse business lifecycle states. `archived` is not a tombstone and is synchronized as an `upsert` snapshot.

Every envelope carries:

- `operationId`
- `requestId`
- `idempotencyKey`
- durable reference (`companyId`, `warehouseId`, `displayCode`)
- optimistic local `version`
- optional positive `serverRevision`
- `changedAt`
- origin (`sourceSystem`, optional `sourceInstanceId`)
- optional synchronization external references

## Local Version and Server Revision

- `version` is the positive monotonic optimistic version owned by the local/current persistence state.
- `serverRevision` is nullable before a record has a known canonical server revision.
- A positive `serverRevision` may be carried after future server acknowledgement or remote projection.
- Step 10 defines compatibility only; it does not define conflict policy, winner selection, merge strategy, or acknowledgement processing.

## Origin and External References

Origin metadata identifies where a change originated without coupling the Domain to transport:

- `sourceSystem`
- optional `sourceInstanceId`

Synchronization external references are separate from Warehouse business identifiers and contain:

- `sourceSystem`
- `externalId`

Within a Company the same synchronization source identity must not ambiguously map to multiple Warehouses.

## SQLite Preparation

Migration `0023_warehouse_sync_metadata.sql` adds:

- `warehouses.deleted_at` for future tombstone persistence.
- `origin_system` and optional `origin_instance_id`.
- nullable `server_revision` for future server-side revision compatibility.
- `warehouse_sync_external_references` for durable source mappings.
- change-feed, tombstone, server-revision and external-reference indexes.

These columns and indexes are preparatory. They do not create a sync queue or imply that network synchronization is enabled.

## Idempotency Boundary

`idempotencyKey` belongs to the canonical change envelope and must remain stable for retriable processing of the same logical change. `requestId` correlates the originating application request and `operationId` identifies the generated synchronization operation.

Concrete persistence of idempotency claims/results remains an adapter responsibility. Phase 19 must not infer idempotency from mutable Warehouse fields such as code, title, timestamps, or external identifiers.

## Adapter Boundary

Future adapters may project the contract to:

- SQLite change readers/writers.
- Argin Bridge transport.
- .NET application/API endpoints.
- PostgreSQL persistence.
- background synchronization jobs.

The canonical envelope must not contain HTTP URLs/methods, retry counters, queue message IDs, socket state, online/offline flags, network errors, or bridge connection configuration.

## Phase Boundary

Phase 19 Step 10 does not implement:

- change polling
- push/pull transport
- remote writes
- acknowledgements
- retry/backoff
- offline delivery queues
- conflict resolution
- last-write-wins
- merge UI
- server authority policy
- Zone/Location independent sync transport

Those concerns remain owned by Argin Bridge and the dedicated Synchronization phase.
