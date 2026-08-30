# Party Argin Bridge Contract

## Purpose

This document freezes the Phase 17 compatibility boundary for future Party synchronization. It does not implement network transport, background synchronization, server APIs, conflict-resolution UI, or the Phase 45 synchronization engine.

## Durable Identity

`Party.id` is the durable cross-database identity. It must remain stable across SQLite, PostgreSQL, HTTP, import, and bridge adapters. `Party.code` is a human-facing/display number and must never be used as the synchronization identity.

Child records such as contacts and addresses already use durable string identifiers. They must not be re-identified by array position or SQLite row order.

## Concurrency and Change Ordering

Party persistence stores an integer `version` beginning at 1. Every successful aggregate update increments the version. Future bridge consumers must use `(companyId, partyId, version)` as the optimistic change-order boundary and must never allow an older version to overwrite a newer version.

`updatedAt` is durable Gregorian change metadata useful for incremental scanning, diagnostics, and ordering within a version-aware pipeline. Timestamps alone are not a substitute for optimistic concurrency.

## Tombstones

Business lifecycle status and synchronization deletion are separate concepts:

- `active` / `inactive` is normal Party lifecycle state.
- `deleted_at IS NOT NULL` represents a synchronization tombstone.

Phase 17 introduces tombstone-compatible storage only. It intentionally does not add a user-facing delete command or automatic purge. Future synchronization must propagate tombstones before any physical cleanup policy is considered.

A tombstone bridge envelope contains no business snapshot, but still carries durable Party identity, display code, version, change timestamp, deletion timestamp, operation id, and idempotency key.

## External References

`party_external_references` maps a Party to identities originating in external systems. A reference consists of `source_system` plus `external_id` and is unique company-wide for that source.

External references are traceability/integration identifiers; they never replace `Party.id` as Argin's durable identity.

## Retry and Idempotency Boundary

Every future bridge mutation envelope carries both:

- `operationId`: identity of the logical synchronization operation.
- `idempotencyKey`: stable retry key supplied unchanged on retries of the same logical operation.

Adapters must treat repeated delivery with the same idempotency key as replay of the same logical operation, not as a new business mutation. Phase 17 defines this contract but does not implement a network idempotency store or transport retry engine.

## Sync Envelope

The public persistence-neutral contract is exported from `@argin/party` as `PartySyncChangeEnvelope` with a discriminated `changeKind`:

- `upsert`: contains a normalized Party sync snapshot.
- `tombstone`: contains `deletedAt` and a null snapshot.

The envelope explicitly carries durable identity separately from display code, version, `changedAt`, external references, operation identity, and idempotency identity.

## Persistence Added in Phase 17

Migration `0017_party_sync_metadata.sql` adds:

- `parties.deleted_at` for tombstone-compatible lifecycle storage.
- `party_external_references` for external/source identity traceability.
- indexes for incremental Party change scans, tombstone scans, and external-reference lookup.

No remote endpoint, queue, sync worker, conflict resolver, or PostgreSQL implementation is introduced.

## Deferred to Phase 45

Phase 45 remains responsible for the actual synchronization engine, including transport, scheduling, batching, checkpoints/cursors, durable idempotency processing, retries, conflict policies, server-side persistence, observability, and user-facing conflict resolution where required.

The Phase 17 contract exists so those capabilities can be added without redesigning Party identity, versioning, deletion propagation, or external-reference semantics.
