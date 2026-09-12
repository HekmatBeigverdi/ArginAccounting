# Phase 21 — Inventory Valuation — Fixed Implementation Plan

## Status

Steps 1–14 are complete on `phase/21-inventory-valuation`. The fixed 20-step sequence is frozen. Step 15 — Permissions, Audit and Traceability — is next.

## Governance

The 20 step titles, order and ownership boundaries are frozen unless an explicitly approved Change Request is recorded here. Owner acceptance and executable validation output are separate evidence; this record never invents command output.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [GitHub Publishing Workflow](../development/github-publishing-workflow.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Contributing](../../CONTRIBUTING.md)
- [Phase 20 — Inventory Documents](phase-20-inventory-documents-plan.md)
- [Inventory Valuation Domain Foundation](../architecture/inventory-valuation-domain.md)
- [Inventory Valuation Strategies](../architecture/inventory-valuation-strategies.md)
- [Inventory Valuation Policy](../architecture/inventory-valuation-policy.md)
- [Inventory Inbound Cost Basis](../architecture/inventory-inbound-cost-basis.md)
- [Inventory Outflow Cost Engine](../architecture/inventory-outflow-cost-engine.md)
- [Inventory Transfer Cost Continuity](../architecture/inventory-transfer-cost-continuity.md)
- [Inventory Adjustment, Reversal and Reverse Valuation](../architecture/inventory-adjustment-reversal-valuation.md)
- [Inventory Valuation Recalculation](../architecture/inventory-valuation-recalculation.md)
- [Inventory Negative Stock and Cost Resolution](../architecture/inventory-negative-stock-cost-resolution.md)
- [Inventory Valuation Application and Repository Contracts](../architecture/inventory-valuation-application-contracts.md)
- [Inventory Valuation SQLite Persistence](../architecture/inventory-valuation-sqlite-persistence.md)
- [Inventory Valuation Atomicity, Idempotency and Optimistic Concurrency](../architecture/inventory-valuation-atomicity-idempotency-concurrency.md)
- [Inventory Valuation Argin Bridge Synchronization Contract](../architecture/inventory-valuation-argin-bridge-sync.md)

## Baseline and Release Target

- Baseline: `main` at `fa5ffa0301248dd64332f19f77181e37a8da5c6e`, after Phase 20 Inventory Documents.
- Branch: `phase/21-inventory-valuation`.
- Target version/tag: `0.21.0` / `v0.21.0`.
- Release title: `ArginAccounting v0.21.0 — Inventory Valuation`.
- Tag and GitHub Release publication remain manual owner actions.

## Objective

Phase 21 adds deterministic, auditable monetary valuation on top of the immutable exact-quantity movement ledger from Phase 20. It delivers FIFO and moving weighted average, durable valuation entries/cost layers, cost resolution, transfer/reversal continuity, backdated recalculation, monetary reports, SQLite persistence, security/audit, and Argin Bridge-compatible contracts without rewriting quantity history.

## Core Invariants

- Phase 20 remains authoritative for immutable quantity movement facts and chronology.
- FIFO and moving weighted average are versioned, persistence-neutral strategies.
- The same ordered authoritative facts + cost inputs + strategy version must produce the same result.
- Exact quantities use decimal strings; monetary totals use safe integers in the declared currency's smallest unit.
- Unknown cost remains explicitly unresolved and is never silently treated as zero.
- Company valuation policy selects the active method; Phase 21 has no per-document/Product/Warehouse method switching.
- Policy history is append-only by effective chronology; direct method mutation locks after authoritative valuation begins.
- Transfer conserves both quantity and monetary value and does not create artificial P&L.
- Reversal is linked compensation, not history rewrite.
- Backdated changes invalidate downstream monetary state and are deterministically recalculated from the earliest affected point.
- Product monetary concurrency scope is Company + Product across warehouses because transfer can propagate cost between locations.
- Retry safety uses durable request identity and exact operation/fingerprint matching; request-id reuse with different payload is a conflict.
- Phase 20 movement facts, Company valuation policy history and resolved valuation cost inputs are authoritative Bridge inputs; valuation Entry/Layer/State projections are rebuildable and never synchronized as independent truth.
- Accounting journal posting is outside Phase 21.

## Argin Bridge Requirements

Authoritative valuation facts and policy history use durable IDs independent of SQLite row identity. Phase 20 movement IDs, policy IDs, cost-basis IDs, strategy version, currency, stream revisions, request identities and effective chronology must survive future synchronization. Phase 21 valuation sync uses versioned envelopes for policy history and resolved cost inputs; derived entries, cost layers and state projections are rebuilt at the destination. SQLite Desktop and future PostgreSQL/.NET Server implementations must derive identical valuation from identical authoritative facts and algorithm versions. Live transport, acknowledgements, dependency queues, retries and distributed conflict resolution remain Phase 45 scope.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Inventory Valuation Domain Model | Completed |
| 3 | Valuation Strategies | Completed |
| 4 | Product and Warehouse Valuation Policy | Completed |
| 5 | Cost Layers and Inbound Cost Basis | Completed |
| 6 | Outflow Cost Calculation Engine | Completed |
| 7 | Transfer Cost Continuity | Completed |
| 8 | Adjustment, Reversal and Reverse Valuation | Completed |
| 9 | Backdated Documents and Recalculation Engine | Completed |
| 10 | Negative Stock and Cost Resolution Policy | Completed |
| 11 | Application and Repository Contracts | Completed |
| 12 | Persistence, Migration and SQLite Repository | Completed |
| 13 | Atomicity, Idempotency and Optimistic Concurrency | Completed |
| 14 | Argin Bridge and Valuation Synchronization Contract | Completed |
| 15 | Permissions, Audit and Traceability | Not started |
| 16 | Valuation Query Engine and Reports | Not started |
| 17 | Persian RTL Inventory Valuation Workspace | Not started |
| 18 | Domain and Application Tests | Not started |
| 19 | Repository, Migration, Bridge and Performance Tests | Not started |
| 20 | Monorepo Validation, Documentation, Final Review and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, Scope and Plan Freeze
Freeze the Phase 20-complete baseline, branch, scope, ownership boundaries, Argin Bridge invariants and numbered plan.

### Step 2 — Inventory Valuation Domain Model
Define persistence-neutral valuation entries, cost layers, valuation basis, resolved/unresolved state, strategy identity/version, money/currency semantics and durable source references.

### Step 3 — Valuation Strategies
Implement versioned deterministic FIFO and moving weighted-average strategy contracts, exact arithmetic and rounding policy.

### Step 4 — Product and Warehouse Valuation Policy
Implement the Company-scoped Inventory Valuation Policy, effective chronology, direct-mutation lock and controlled transitions. Product/Warehouse streams consume the Company policy and do not choose methods independently in Phase 21.

### Step 5 — Cost Layers and Inbound Cost Basis
Implement inbound monetary basis, layer/state creation and deterministic landed-cost allocation primitives.

### Step 6 — Outflow Cost Calculation Engine
Resolve ordinary issue/outflow cost from historical stream state using the policy effective for the relevant chronology, without over-consuming available cost basis.

### Step 7 — Transfer Cost Continuity
Carry cost atomically across transfer source/destination while conserving quantity and monetary value.

### Step 8 — Adjustment, Reversal and Reverse Valuation
Define monetary behavior for opening/adjustment/reversal and linked compensation without editing Phase 20 history.

### Step 9 — Backdated Documents and Recalculation Engine
Find the earliest affected point and deterministically recalculate downstream valuation state.

### Step 10 — Negative Stock and Cost Resolution Policy
Define blocked/deferred valuation and explicit unresolved states for negative/unknown-cost edge cases.

### Step 11 — Application and Repository Contracts
Define commands, queries, DTOs, repositories, Unit of Work, errors, recalculation ports, policy-transition contracts and future ERP cost-input boundaries.

### Step 12 — Persistence, Migration and SQLite Repository
Add versioned SQLite schema, constraints, indexes and repositories for authoritative valuation facts, policy history and required projections.

### Step 13 — Atomicity, Idempotency and Optimistic Concurrency
Implement transaction boundaries, replay protection, expected-version semantics and same-stream/policy race protection.

### Step 14 — Argin Bridge and Valuation Synchronization Contract
Freeze versioned persistence-neutral synchronization envelopes and authoritative/derived-state boundaries.

### Step 15 — Permissions, Audit and Traceability
Protect privileged monetary operations and policy transitions and record explainable before/after valuation history.

### Step 16 — Valuation Query Engine and Reports
Deliver bounded on-hand value, monetary Kardex, Product/Warehouse value, layer detail, as-of, unresolved and recalculation reports.

### Step 17 — Persian RTL Inventory Valuation Workspace
Deliver Persian RTL valuation inspection/diagnostic UI, source drill-down and Company policy/history surfaces.

### Step 18 — Domain and Application Tests
Cover strategy, allocation, transfer, reversal, backdated, unresolved, scope, idempotency and concurrency behavior.

### Step 19 — Repository, Migration, Bridge and Performance Tests
Cover real SQLite upgrade/restart/rollback, policy/history persistence, serialization/replay invariants, Bridge round-trips, query plans and representative scale.

### Step 20 — Monorepo Validation, Documentation, Final Review and Release
Run all gates, reconcile canonical docs, review deferred scope, merge according to workflow and prepare `v0.21.0`.

## Step Evidence

### Steps 1–6

- Froze the Phase 21 scope and baseline after Phase 20.
- Added valuation domain snapshots, FIFO/MWA strategies, Company-scoped policy history, inbound/landed-cost basis, and ordinary outflow cost calculation.
- Exact arithmetic, strategy versioning, policy-effective chronology and explicit unresolved cost semantics are preserved.

### Step 7

- Added transfer cost continuity for FIFO and Moving Weighted Average.
- FIFO transfers exact source-layer quantity/cost into durable destination layers; MWA transfers exact integer monetary value without re-rounding.
- Transfer quantity and monetary value conserve to zero net effect.

### Step 8

- Added monetary opening/adjustment behavior and linked reverse valuation.
- Reversal preserves exact original monetary effect and original policy/method/version/currency rather than repricing at the reversal date.
- Reversal requests deterministic downstream recalculation rather than rewriting Phase 20 history.

### Step 9

- Added persistence-neutral recalculation planning and replay from the earliest affected chronology point.
- Movement/cost/reversal invalidation scopes Company + Product across every warehouse; Company policy changes invalidate Company-wide from `effectiveFrom`.
- Canonical ordering remains `businessDate -> businessOrder -> documentId -> lineId -> movementId`.

### Step 10

- Added versioned negative-stock and cost-resolution policy.
- Default true negative stock behavior is `block`; optional `defer` never fabricates monetary cost.
- Missing/insufficient/upstream cost remains explicit `unresolved` with `unitCost = null` and `totalCost = null`.

### Step 11

- Added valuation Commands, Queries, Repository ports, Unit of Work, recalculation port and ERP/Purchase/Sales cost-input boundary.
- Added durable operation context with `companyId`, `requestId`, `actorId`, and canonical UTC time.
- Kept quantity movements authoritative in Phase 20 and commercial workflow outside valuation ownership.

### Step 12

- Added migrations and SQLite repositories for policy history, resolved cost inputs, valuation entries, FIFO cost layers and dated valuation state projection.
- Policy history is append-only; derived Entry/Layer/State data is rebuildable.
- Added canonical indexes, structural resolved/unresolved checks, FIFO layer cascade behavior and Desktop migration version 28.

### Step 13

- Added `packages/inventory/src/application/contracts/inventory-valuation-concurrency.ts` with durable idempotency records, stream-version contracts, replay decision rules and guarded mutation orchestration.
- Added public subpath `@argin/inventory/valuation-concurrency`.
- Added migration `0029_inventory_valuation_concurrency.sql` and registered Desktop migration version 29.
- Added `inventory_valuation_idempotency` keyed by `(company_id, request_id)` with exact operation/fingerprint replay semantics.
- Added `inventory_valuation_stream_versions` for optimistic compare-and-swap revisions.
- Defined policy streams as `policy:{companyId}` and monetary Product streams as `valuation:{companyId}:{productId}`; Product scope intentionally spans warehouses because transfer propagates monetary dependencies.
- Added `SqliteInventoryValuationIdempotencyRepository`, `SqliteInventoryValuationStreamVersionRepository` and `SqliteInventoryValuationUnitOfWork`.
- SQLite valuation UoW reuses the production pinned `DatabaseExecutor.transaction()` implementation with `BEGIN IMMEDIATE / COMMIT / ROLLBACK` rather than creating a second transaction engine.
- `executeInventoryValuationGuardedMutation()` enforces one transaction order: replay lookup -> stream CAS -> mutation -> durable idempotency outcome. Retry replay does not invoke the mutation or advance revision again.
- Added focused Domain/Application tests for replay/conflict/revision behavior and Tauri adapter tests for migration contracts, CAS and same-session UoW composition.
- Added `docs/architecture/inventory-valuation-atomicity-idempotency-concurrency.md`.
- Real SQLite crash/restart/rollback, multi-connection race and representative-scale validation remain Step 19.
- Raw executable test output is not claimed unless local/CI validation is actually observed.

### Step 14

- Added `packages/inventory/src/application/contracts/inventory-valuation-sync.ts` with `INVENTORY_VALUATION_SYNC_CONTRACT_VERSION = 1` and versioned persistence-neutral Argin Bridge envelopes.
- Added public subpath `@argin/inventory/valuation-sync`.
- Reused Phase 20 Inventory sync metadata conventions: operation/request identity, idempotency key, payload fingerprint, canonical UTC `changedAt`, origin, optional server revision and external references.
- Defined only `valuation-policy` and `valuation-cost-input` as Phase 21 authoritative valuation sync entities. Phase 20 movement envelopes remain the authoritative quantity channel.
- Policy envelopes are append-only, carry Company policy snapshot + stream revision, and declare predecessor policy dependency when applicable.
- Cost-input envelopes carry durable resolved basis identity/entity revision + Product valuation stream revision and declare dependency on the immutable Phase 20 movement.
- Explicitly excluded `valuation-entry`, `valuation-cost-layer` and `valuation-state` from authoritative Bridge payloads; receiving nodes must rebuild them through deterministic recalculation.
- Preserved Step 13 stream identities: `policy:{companyId}` and `valuation:{companyId}:{productId}`. `serverRevision` remains transport/server metadata and does not replace domain stream revision.
- Defined receiving semantics: accepted Cost Input changes invalidate valuation from the referenced movement chronology; accepted historical Policy changes invalidate valuation from `effectiveFrom`; destination nodes run the Step 9 engine rather than importing derived monetary projections.
- Added focused tests for contract versioning, policy predecessor dependency, movement dependency, stream identity/revision checks, UTC normalization, external-reference uniqueness and derived-entity exclusion.
- Added `docs/architecture/inventory-valuation-argin-bridge-sync.md` documenting SQLite/PostgreSQL deterministic parity and Phase 45 boundaries.
- Live transport, remote acknowledgements, dependency queues and distributed conflict winner selection remain Phase 45 Synchronization; Step 14 only freezes the Phase 21 contract.
- Raw executable test output is not claimed unless local/CI validation is actually observed.

## Change Requests

### CR-21-001 — Company-scoped Inventory Valuation Policy Governance

- Date: 2026-09-11
- Status: Approved by owner
- Step sequence impact: none; all 20 step titles/order remain unchanged.
- Company chooses FIFO or Moving Weighted Average; no Phase 21 per-document/Product/Warehouse method selection.
- Direct mutation locks after authoritative valuation begins.
- Changes use controlled policy transitions with `effectiveFrom`, immutable history, authorization/Audit in their owning later steps.
- Prefer fiscal-year-boundary transitions; historical/recalculated valuation resolves the policy effective for relevant chronology.
- Bridge contracts preserve policy identity, method, strategy version, effective date, revision and history.
