# Inventory Valuation — Argin Bridge Synchronization Contract

Phase 21 Step 14 freezes the persistence-neutral synchronization boundary for monetary Inventory Valuation. It does not implement live transport; Phase 45 owns transport, retries, acknowledgements and distributed conflict reconciliation.

## Contract Version

Valuation synchronization uses `INVENTORY_VALUATION_SYNC_CONTRACT_VERSION = 1` through `@argin/inventory/valuation-sync`.

The contract follows the metadata conventions already used by Phase 20 Inventory synchronization:

- durable `operationId`,
- durable `requestId`,
- `idempotencyKey`,
- canonical `payloadFingerprint`,
- canonical UTC `changedAt`,
- origin system/instance,
- optional `serverRevision`,
- external references,
- durable stream identity/revision.

No SQLite row identity is part of the contract.

## Authority Boundary

### Synchronized authoritative valuation inputs

Phase 21 adds only two valuation-specific authoritative entity kinds:

1. `valuation-policy`
   - append-only Company policy history,
   - durable `policyId`,
   - method and strategy version,
   - currency,
   - `effectiveFrom`,
   - predecessor policy identity,
   - policy revision.

2. `valuation-cost-input`
   - resolved inbound cost-basis snapshot,
   - durable `basisLineId`,
   - immutable Phase 20 `movementId`,
   - Product/Warehouse identity,
   - exact quantity and monetary basis,
   - deterministic landed-cost allocation result,
   - entity revision.

Phase 20 Inventory synchronization remains authoritative for immutable quantity movement facts. Phase 21 does not duplicate movement envelopes.

### Never synchronized as authoritative valuation facts

The following are derived/rebuildable and therefore MUST NOT be Bridge source-of-truth payloads:

- `valuation-entry`,
- `valuation-cost-layer`,
- `valuation-state`.

The receiving node derives them from synchronized Phase 20 movements + valuation policy history + resolved cost inputs + supported strategy version.

This prevents SQLite and PostgreSQL/.NET from developing competing monetary truth stores.

## Stream Identity and Revision

Step 13 stream identities are carried unchanged:

- Company policy: `policy:{companyId}`
- Product valuation: `valuation:{companyId}:{productId}`

Each envelope carries `streamRevision` so a future Bridge receiver can detect stale/out-of-order writes. `serverRevision` is separate transport/server acknowledgement metadata and never replaces the domain stream revision.

A Cost Input also carries its own entity `revision`; this is distinct from the Product valuation stream revision.

## Dependencies

A policy transition declares a dependency on its `previousPolicyId` when one exists. A resolved Cost Input declares a dependency on its immutable Phase 20 `movementId`.

A receiver must not materialize/recalculate a dependent valuation input before required authoritative dependencies are available. Transport-level dependency queuing is Phase 45 scope.

## Idempotency

The envelope preserves the Step 13 request identity and fingerprint. Repeated delivery of the same operation/request/fingerprint is a replay; reuse of the same request identity with a different payload is a conflict.

The sync contract does not introduce a second hashing standard. Payload fingerprint generation remains the canonical application serialization concern already established by Step 13.

## Receiving Cost Input

When a newer authoritative Cost Input is accepted, the receiver:

1. stores/upserts the resolved Cost Input by durable identity/revision,
2. finds the referenced immutable Phase 20 movement,
3. invalidates monetary valuation beginning at that movement chronology,
4. invokes the Step 9 deterministic recalculation engine for the Company + Product stream,
5. rebuilds entries/layers/state locally.

The sender does not transfer its derived valuation rows.

## Receiving Policy History

Policy envelopes are append-only. A receiver verifies Company stream identity, revision, predecessor dependency and supported strategy version, then stores the new policy history row.

If the policy is effective within already-valued chronology, downstream monetary state is invalidated from `effectiveFrom` and deterministically rebuilt. A future policy transition with no affected local movements requires no derived-row transport.

## Deterministic Cross-Store Rule

For the same:

- ordered Phase 20 movement facts,
- authoritative resolved Cost Inputs,
- Company policy history,
- strategy version,
- currency and exact arithmetic rules,

SQLite Desktop and PostgreSQL/.NET Server MUST derive equivalent valuation results.

Differences in database row IDs, insertion order, local query order or projection storage are not semantic inputs.

## Conflict Boundary

Step 14 carries enough durable identity/version metadata for future Bridge conflict handling, but does not define distributed winner selection. Local Step 13 optimistic concurrency remains authoritative for same-node mutations. Remote merge/reconciliation policy belongs to Phase 45 Synchronization.

## Security and Audit

Envelope identity does not grant authorization. Step 15 protects valuation operations and records Audit/traceability. Future transport authentication/authorization remains outside this contract.

## Tests

`packages/inventory/tests/inventory-valuation-sync.test.ts` covers contract versioning, policy predecessor dependency, Cost Input movement dependency, stream identity/revision validation, UTC normalization, external-reference uniqueness and exclusion of derived valuation entities.

Executable test success is recorded only when local or CI output is actually observed.
