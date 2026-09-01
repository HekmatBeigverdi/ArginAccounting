# Product/Service Synchronization Contract

## Status

Phase 18 establishes the Product/Service synchronization-facing contract only. It does not implement the Argin Bridge transport or the Phase 45 synchronization engine.

## Target Direction

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

## Durable Identity

- `productId` is the durable cross-store identity.
- `code` is a human-readable display/local code and must not be used as the synchronization identity.
- `companyId` is always part of the synchronization scope.
- Persistence adapters must not expose SQLite row ids as Product identity.

## Change Envelope

Product changes are represented as either:

- `upsert` — carries a full Product master-data snapshot.
- `tombstone` — carries durable identity/version/deletion metadata and no business snapshot.

Ordinary Product status (`active` / `inactive`) is business lifecycle state and is not a deletion signal. An inactive Product remains an `upsert` record. Tombstone semantics are reserved for propagation of deletion in future synchronization flows.

Each envelope carries:

- `operationId`
- `requestId`
- `idempotencyKey`
- durable entity reference (`companyId`, `productId`, `displayCode`)
- optimistic `version`
- `changedAt`
- optional external/source references

## External References

External references map a Product to identifiers owned by another source system using:

- `sourceSystem`
- `externalId`

The same external source identity must not map ambiguously inside a company. SQLite stores these mappings separately from Product business identifiers such as SKU, barcode, or Taxpayer goods/service ID.

## SQLite Preparation

Phase 18 migration `0020_product_sync_metadata.sql` adds:

- `products.deleted_at` for future tombstone persistence.
- `product_sync_external_references` for durable source mappings.
- change-feed-friendly `(company_id, updated_at, version, id)` index.
- tombstone lookup index.

This schema is preparatory. Step 10 does not implement change polling, transport delivery, acknowledgements, retries, remote writes, or conflict resolution.

## Adapter Boundary

The synchronization contract is persistence-neutral. Future adapters may project the same envelope to:

- SQLite change readers/writers.
- Argin Bridge transport.
- .NET HTTP/application endpoints.
- PostgreSQL persistence.
- queued/background synchronization jobs.

Transport-specific fields such as URL, HTTP method, retry counters, queue message ids, connection state, or network errors must not be added to Domain Product snapshots or the canonical sync envelope.

## Concurrency and Idempotency

- `version` is the optimistic entity version and must be positive and monotonic for persisted mutations.
- `requestId` correlates the originating application request.
- `operationId` identifies the synchronization operation/change event.
- `idempotencyKey` is a stable deduplication identity for retriable transport/application processing.

The concrete idempotency store and optimistic SQLite update behavior remain adapter responsibilities.

## Phase Boundary

Phase 18 does not implement:

- network synchronization
- bridge discovery/connectivity
- server conflict resolution
- last-write-wins policy
- merge UI
- offline queue delivery
- remote acknowledgements
- sync retry/backoff

Those concerns remain owned by the future Argin Bridge implementation and Phase 45 Synchronization.
