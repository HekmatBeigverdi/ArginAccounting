# Inventory Valuation Application and Repository Contracts

## Purpose

Phase 21 Step 11 freezes the persistence-neutral Application boundary for inventory valuation. It connects the monetary Domain primitives from Steps 2–10 to future application orchestration without selecting a database, transaction implementation or live Bridge transport.

## Command Boundary

The Application contract exposes commands for:

- initial Company valuation-policy setup;
- controlled policy transition with expected current policy identity/revision;
- resolution of one movement valuation;
- deterministic recalculation triggered by backdated movement, cost input, reversal or policy change.

Every command carries a normalized operation context containing `companyId`, durable `requestId`, `actorId` and `occurredAt`. Step 13 owns concrete idempotency/concurrency enforcement; Step 15 owns permission and Audit behavior.

## Query Boundary

The query contract exposes:

- valuation entry by movement;
- unresolved valuations;
- Company valuation-policy history;
- current/as-of valuation state reference.

Step 16 owns richer reporting projections such as monetary Kardex, Product/Warehouse value and layer detail.

## Repository Ownership

Valuation repositories are separated by authority:

### Authoritative valuation facts

- `InventoryValuationPolicyRepository` stores append-only Company policy history.
- `InventoryValuationCostInputProvider` supplies authoritative resolved inbound cost basis from ERP/Purchase/Sales-facing adapters.

The valuation module does not own invoice, vendor, freight, landed-cost commercial workflow or Treasury persistence.

### Immutable quantity facts

`InventoryValuationMovementReader` reads Phase 20 movement facts. Valuation never rewrites the quantity ledger.

### Rebuildable monetary state

- `InventoryValuationEntryRepository`
- `InventoryCostLayerRepository`
- `InventoryValuationStateRepository`

These contracts may replace derived rows from a deterministic recalculation boundary. They do not become an independent source of truth over Phase 20 movements or authoritative cost inputs.

## Unit of Work

`InventoryValuationUnitOfWork` exposes entries, policies, layers, state, movement reader and cost-input provider in one application transaction seam.

Step 12 implements SQLite repositories. Step 13 defines the concrete atomicity, idempotency and optimistic-concurrency behavior. The contract intentionally does not expose SQLite connection objects or row IDs.

## Recalculation Port

`InventoryValuationRecalculationPort` is the application orchestration seam over the deterministic Step 9 planner/replay engine. Its result reports the plan plus recalculated and unresolved movement counts.

The pure chronology/replay algorithm remains a Domain concern. Repository replacement and transactional commit remain infrastructure concerns.

## Argin Bridge Compatibility

The contracts use durable Company, movement, policy and valuation identities rather than local database row identity. A future PostgreSQL/.NET implementation can implement the same ports and consume the same Domain algorithms.

Bridge transport, acknowledgement, retry and remote conflict resolution remain Phase 45 scope. Step 14 freezes the Phase 21 synchronization envelopes and authoritative/derived boundaries.

## Deferred Scope

Step 11 does not implement:

- SQLite schema or repositories;
- real Unit of Work transaction execution;
- idempotency storage;
- optimistic concurrency persistence;
- permissions/Audit execution;
- report projections/UI;
- live Argin Bridge transport.
