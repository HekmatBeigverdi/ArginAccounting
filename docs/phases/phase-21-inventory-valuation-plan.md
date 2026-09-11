# Phase 21 — Inventory Valuation — Fixed Implementation Plan

## Status

Step 1 is complete. The fixed 20-step implementation sequence is frozen on `phase/21-inventory-valuation`. Step 2 is next.

## Governance

This 20-step sequence is frozen. Titles, order, scope and exit criteria change only through an explicitly approved Change Request. Owner acceptance and raw executable validation output remain distinct evidence; this record must never fabricate command output that was not actually observed.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [GitHub Publishing Workflow](../development/github-publishing-workflow.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Contributing](../../CONTRIBUTING.md)
- [Phase 20 — Inventory Documents](phase-20-inventory-documents-plan.md)

## Baseline and Release Target

- Planning baseline: `main` at `fa5ffa0301248dd64332f19f77181e37a8da5c6e` (`merge: release phase 20 inventory documents`).
- Phase branch: `phase/21-inventory-valuation`.
- Target version/tag: `0.21.0` / `v0.21.0`.
- Release title: `ArginAccounting v0.21.0 — Inventory Valuation`.
- Tag and GitHub Release publication remain explicit repository-owner actions.

## Objective

Phase 21 adds the monetary valuation layer on top of the immutable exact-quantity movement ledger delivered by Phase 20. It must answer, deterministically and auditably, how much on-hand inventory is worth, how much cost leaves inventory with an issue, how transfer and reversal preserve cost semantics, and how backdated facts trigger downstream recalculation without rewriting Phase 20 quantity history.

The phase delivers:

- FIFO valuation;
- moving weighted-average valuation;
- durable cost layers and valuation entries;
- inbound cost basis and landed-cost allocation contracts;
- issue/outflow cost resolution;
- transfer cost continuity;
- reversal and adjustment valuation;
- deterministic backdated recalculation;
- explicit unresolved/negative-stock cost policy;
- monetary Kardex and inventory valuation reports;
- Persian RTL valuation workspace and source drill-down;
- SQLite persistence, atomicity, idempotency, optimistic concurrency, Audit/security and performance validation;
- persistence-neutral Argin Bridge contracts for future synchronization.

## Scope Boundaries

### In Scope

- Monetary valuation derived from confirmed Phase 20 movement facts.
- FIFO and moving weighted average as operational strategies.
- Cost-layer creation/consumption and valuation-entry history.
- Exact monetary arithmetic using repository Money/decimal conventions; binary floating point is forbidden.
- Inbound cost basis plus deterministic landed-cost allocation primitives that later Purchase workflows can supply.
- Transfer, quantity adjustment, opening, reversal and backdated valuation behavior.
- Company/Branch/fiscal scope, permissions, Audit, idempotency and optimistic concurrency.
- Recalculation state, dependency ordering and deterministic replay.
- Monetary inventory queries, reports and source traceability.
- Argin Bridge-compatible durable identities, revisions, tombstone/external-reference semantics and deterministic replay contracts.

### Explicitly Out of Scope

- Purchase commercial workflow ownership and Purchase Posting (Phases 22–23).
- Sales commercial workflow ownership and Sales Posting (Phases 24–25).
- Treasury behavior.
- Automatic Journal Voucher creation and Posting Rules (later posting phases).
- Iranian Taxpayer projection/signing/submission.
- Manufacturing costing and advanced Cost Accounting.
- Reservations/ATP, lot/serial/expiry tracking and full stock-count sessions unless introduced by a later approved phase.
- Live Argin Bridge transport, outbox, acknowledgement, retry scheduling, server conflict-resolution UI and PostgreSQL/.NET synchronization runtime; those remain owned by Phase 45 Synchronization.

## Phase 20 Dependency Contract

Phase 21 consumes Phase 20 immutable quantity facts. It must not alter document quantity semantics, movement quantity, stock balance history or reversal identities.

Authoritative chronological input remains the Phase 20 movement stream ordered by its canonical business chronology. Valuation may create its own durable derived monetary facts, but a recalculation invalidates/rebuilds valuation state only; it never rewrites the source movement ledger.

The following source identities must remain traceable through valuation:

- `documentId`
- `documentLineId`
- `movementId`
- transfer/reversal linkage where applicable
- Product, Warehouse, Zone and Location durable identities
- Company/Branch/fiscal scope
- business date/business order

## Core Architecture Invariants

- Quantity facts are owned by Phase 20; monetary valuation facts are owned by Phase 21.
- Cost strategy is pluggable and persistence-neutral. FIFO and moving weighted average are the first operational strategies.
- A valuation result is reproducible from the same ordered source facts, cost inputs, strategy and configuration.
- Exact decimal/Money arithmetic is mandatory; binary floating point is forbidden.
- Historical valuation is append/rebuild oriented. Confirmed source history is never silently edited to make a valuation result fit.
- Transfer conserves inventory cost across source and destination. Ordinary inter-warehouse movement does not create profit/loss.
- Reversal creates linked compensating valuation semantics consistent with the Phase 20 reversal rather than mutating prior quantity facts.
- Backdated source/cost changes identify an affected valuation stream and recalculate downstream valuation in deterministic business chronology.
- Derived balance/value projections are rebuildable and are not independent authoritative synchronization facts.
- Multi-write valuation operations are atomic within one Unit of Work.
- Idempotent replay returns the previous durable outcome; changed payload under the same request identity is a conflict.
- Optimistic concurrency and transaction-scoped validation protect concurrent recalculation and cost consumption.
- Posting/accounting journal creation is not performed in this phase.

## Argin Bridge Contract — Mandatory From the Start

Phase 21 is offline-first today but must remain safe for the future Argin Bridge hybrid architecture.

Every synchronization-capable authoritative valuation fact must use durable IDs that are independent of SQLite row ids, display numbers or local sequence positions. Contracts must carry enough metadata for idempotent replay, conflict detection and deterministic reconstruction without synchronizing rebuildable projections as independent facts.

Required Bridge properties include:

- durable valuation/cost-layer identities;
- stable source movement/document identities;
- Company scope;
- strategy/version identity;
- exact quantity and monetary encodings;
- revision/expected-version semantics;
- idempotency request identity and fingerprint where commands are replayable;
- external references/source-system metadata where applicable;
- tombstone/retirement compatibility for authoritative records that may be logically removed;
- deterministic ordering and recalculation trigger metadata;
- no duplicate valuation side effects after retry/restart/transport replay.

SQLite Desktop and a future PostgreSQL/.NET server must be capable of deriving the same result from the same authoritative facts and algorithm version. Live transport remains deferred to Phase 45.

## Valuation Strategy Baseline

### FIFO

Inbound cost layers are consumed oldest-first according to deterministic business chronology. Partial consumption must preserve the remaining exact layer quantity and monetary basis.

### Moving Weighted Average

Each qualifying inbound cost fact updates the moving average cost. Outflow consumes quantity at the resolved average applicable at that chronological point. Backdated facts may therefore require recalculation of subsequent averages and outflow costs.

The strategy contract must allow later strategies without coupling Domain/Application rules to SQLite or Desktop code.

## Landed Cost Boundary

Phase 21 owns the valuation mechanics for allocating additional inbound cost to eligible inventory cost bases. The allocation engine must support deterministic methods (for example quantity, value or explicitly supplied weight basis) and preserve allocation traceability and rounding remainder rules.

Phase 21 does not own Purchase invoices, freight/vendor commercial workflows or Treasury settlement. Later modules provide authoritative cost inputs through bounded contracts; valuation consumes them without taking ownership of their business documents.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Inventory Valuation Domain Model | Not started |
| 3 | Valuation Strategies | Not started |
| 4 | Product and Warehouse Valuation Policy | Not started |
| 5 | Cost Layers and Inbound Cost Basis | Not started |
| 6 | Outflow Cost Calculation Engine | Not started |
| 7 | Transfer Cost Continuity | Not started |
| 8 | Adjustment, Reversal and Reverse Valuation | Not started |
| 9 | Backdated Documents and Recalculation Engine | Not started |
| 10 | Negative Stock and Cost Resolution Policy | Not started |
| 11 | Application and Repository Contracts | Not started |
| 12 | Persistence, Migration and SQLite Repository | Not started |
| 13 | Atomicity, Idempotency and Optimistic Concurrency | Not started |
| 14 | Argin Bridge and Valuation Synchronization Contract | Not started |
| 15 | Permissions, Audit and Traceability | Not started |
| 16 | Valuation Query Engine and Reports | Not started |
| 17 | Persian RTL Inventory Valuation Workspace | Not started |
| 18 | Domain and Application Tests | Not started |
| 19 | Repository, Migration, Bridge and Performance Tests | Not started |
| 20 | Monorepo Validation, Documentation, Final Review and Release | Not started |

## Fixed Execution Sequence and Exit Criteria

### Step 1 — Baseline, Branch, Scope and Plan Freeze

Record the Phase 20-complete `main` baseline, create `phase/21-inventory-valuation`, reconcile roadmap/phase documentation, freeze this numbered sequence, define ownership boundaries, and make Argin Bridge invariants mandatory before Domain implementation begins.

**Exit:** branch exists from the correct Phase 20-complete baseline; this canonical plan is committed; Step Status is current; no valuation implementation has started ahead of the frozen plan.

### Step 2 — Inventory Valuation Domain Model

Define persistence-neutral aggregate/value-object concepts for valuation streams, valuation entries, cost layers, cost basis, resolved/unresolved cost state, strategy identity/version and durable source references.

**Exit:** Domain model represents monetary valuation without depending on SQLite, Desktop, Purchases, Sales or Posting.

### Step 3 — Valuation Strategies

Define and implement strategy abstractions and deterministic FIFO/moving-weighted-average behavior, including exact arithmetic, rounding policy and strategy versioning.

**Exit:** identical ordered inputs produce identical strategy results and future strategies can be added without rewriting consumers.

### Step 4 — Product and Warehouse Valuation Policy

Define Company-scoped policy for selecting valuation strategy, defaulting, Product overrides if allowed, Warehouse implications, effective-date rules and controlled strategy changes.

**Exit:** invalid mid-history strategy changes cannot silently corrupt prior valuation.

### Step 5 — Cost Layers and Inbound Cost Basis

Create inbound monetary basis, FIFO layers/moving-average inputs and deterministic landed-cost allocation mechanics with traceable source references, allocation basis and rounding remainder handling.

**Exit:** each eligible confirmed inbound quantity fact can acquire a reproducible monetary basis without Purchase workflow ownership leaking into Inventory Valuation.

### Step 6 — Outflow Cost Calculation Engine

Resolve cost for issues and other outbound movements according to the active strategy and historical stream state.

**Exit:** outflow cost is exact, reproducible, source-traceable and cannot over-consume cost layers.

### Step 7 — Transfer Cost Continuity

Carry cost from transfer source to destination atomically, preserving conservation through Warehouse/Zone/Location changes and both valuation strategies.

**Exit:** ordinary transfer neither duplicates nor destroys quantity/cost and does not create artificial profit/loss.

### Step 8 — Adjustment, Reversal and Reverse Valuation

Define valuation semantics for signed quantity adjustment, opening, complete/partial compensating behavior where supported by Phase 20, and linked reversal.

**Exit:** correction/reversal never rewrites Phase 20 quantity history and monetary consequences remain traceable to original/compensating facts.

### Step 9 — Backdated Documents and Recalculation Engine

Detect affected valuation streams, determine earliest invalidated chronological point, rebuild downstream layers/averages/outflow costs deterministically and expose recalculation state/failure semantics.

**Exit:** backdated confirmed facts cannot leave silent stale monetary valuation downstream.

### Step 10 — Negative Stock and Cost Resolution Policy

Define behavior for negative-stock edge cases, temporarily unresolved cost, zero/unknown inbound cost and blocked vs deferred valuation transitions consistent with Phase 20 quantity policy.

**Exit:** no guessed monetary cost is silently fabricated; unresolved states are explicit and queryable.

### Step 11 — Application and Repository Contracts

Define commands, queries, DTOs, repositories, Unit of Work, bounded readers, error taxonomy, recalculation ports and future ERP cost-input contracts.

**Exit:** Application remains persistence-neutral and usable by Desktop plus future server adapters.

### Step 12 — Persistence, Migration and SQLite Repository

Add versioned schema/migration, constraints, indexes and SQLite repositories for authoritative valuation facts, cost layers, policy/configuration, idempotency/recalculation metadata and rebuildable projections as appropriate.

**Exit:** fresh install and upgrade path preserve exact values, durable IDs and Company isolation.

### Step 13 — Atomicity, Idempotency and Optimistic Concurrency

Implement transaction boundaries, replay fingerprints, same-stream race protection, expected-version handling and restart-safe multi-write behavior.

**Exit:** retry/concurrency cannot duplicate cost effects, partially consume layers or leave half-recalculated state.

### Step 14 — Argin Bridge and Valuation Synchronization Contract

Freeze versioned persistence-neutral Bridge envelopes and authoritative/derived-state boundaries for valuation facts, source references, revisions, tombstones/external references and recalculation triggers.

**Exit:** future SQLite ↔ PostgreSQL/.NET synchronization can replay authoritative valuation facts without duplicate side effects or using local database row identity.

### Step 15 — Permissions, Audit and Traceability

Define view/recalculate/policy/admin permissions, Company/Branch enforcement and Audit events for strategy/policy changes, cost inputs, allocation, recalculation and conflicts.

**Exit:** every privileged monetary mutation is authorized and explainable.

### Step 16 — Valuation Query Engine and Reports

Deliver bounded monetary queries for on-hand value, monetary Kardex, Product/Warehouse valuation, cost-layer detail, as-of-date value, unresolved valuation and recalculation status with source drill-down.

**Exit:** report totals reconcile to authoritative valuation state and respect scope/security.

### Step 17 — Persian RTL Inventory Valuation Workspace

Deliver Persian RTL valuation workspace using the shared design system, Jalali boundary, LTR numeric/code fields, loading/empty/error/focus/responsive states and drill-down to source document/movement/cost layer.

**Exit:** operational users can inspect and diagnose valuation without direct database access.

### Step 18 — Domain and Application Tests

Cover FIFO, moving average, landed-cost allocation, transfer conservation, adjustment/reversal, backdated recalculation, unresolved/negative scenarios, scope, idempotency and concurrency contracts.

**Exit:** deterministic monetary rules are executable specifications at Domain/Application level.

### Step 19 — Repository, Migration, Bridge and Performance Tests

Cover real SQLite migration/upgrade/restart/rollback, exact persistence, transaction failure, recalculation durability, Bridge serialization/replay invariants, query plans and representative high-volume movement/valuation datasets.

**Exit:** persistence and performance evidence demonstrates no correctness regression under realistic scale.

### Step 20 — Monorepo Validation, Documentation, Final Review and Release

Run focused and monorepo gates; reconcile module/architecture/database/security/glossary/ADR/changelog/roadmap records; update Step Status; review deferred scope; merge phase -> develop -> main according to repository workflow; prepare `v0.21.0` release identity.

**Exit:** Phase Definition of Done is satisfied with observed evidence. Tag and GitHub Release publication remain manual owner actions.

## Step 1 Evidence

- Verified `main` is Phase 20-complete at `fa5ffa0301248dd64332f19f77181e37a8da5c6e` with merge message `merge: release phase 20 inventory documents`.
- Created `phase/21-inventory-valuation` from `main`.
- Confirmed Phase 20 explicitly defers FIFO, moving average, cost layers, landed cost and monetary valuation reports to Phase 21.
- Confirmed Phase 20 exposes immutable quantity movement/source identities for Phase 21 consumption and forbids valuation from rewriting quantity history.
- Frozen the 20-step Phase 21 execution sequence and Argin Bridge requirements in this canonical plan.

## Change Requests

None.
