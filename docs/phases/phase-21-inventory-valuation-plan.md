# Phase 21 — Inventory Valuation — Fixed Implementation Plan

## Status

Steps 1–3 are complete on `phase/21-inventory-valuation`. The fixed 20-step sequence is frozen. Step 4 — Product and Warehouse Valuation Policy — is next.

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

## Baseline and Release Target

- Baseline: `main` at `fa5ffa0301248dd64332f19f77181e37a8da5c6e`, after Phase 20 Inventory Documents.
- Branch: `phase/21-inventory-valuation`.
- Target version/tag: `0.21.0` / `v0.21.0`.
- Release title: `ArginAccounting v0.21.0 — Inventory Valuation`.
- Tag and GitHub Release publication remain manual owner actions.

## Objective

Phase 21 adds deterministic, auditable monetary valuation on top of the immutable exact-quantity movement ledger from Phase 20. It delivers FIFO and moving weighted average, durable valuation entries/cost layers, cost resolution, transfer/reversal continuity, backdated recalculation, monetary reports, SQLite persistence, security/audit, and Argin Bridge-compatible contracts without rewriting quantity history.

## Scope and Ownership Boundaries

Phase 21 owns monetary valuation derived from confirmed Phase 20 movement facts. Phase 20 remains authoritative for document quantity, movement quantity, transfer/reversal identity and quantity chronology. Purchases/Sales own commercial documents; Posting phases own accounting journal creation; Phase 45 owns live Argin Bridge transport, retry, acknowledgement and remote conflict-resolution runtime.

Valuation must preserve `movementId`, source document/line identity, Product/Warehouse/Zone/Location identity, Company scope, transfer/reversal links and canonical business chronology. Recalculation may rebuild monetary derived state only; it never edits Phase 20 quantity facts.

## Core Invariants

- FIFO and moving weighted average are versioned, persistence-neutral strategies.
- The same ordered authoritative facts + cost inputs + strategy version must produce the same result.
- Inventory quantities remain exact decimal strings.
- Monetary totals follow shared Platform Money semantics: safe integer in the declared currency's smallest unit.
- Exact decimal unit cost is retained where average unit cost can be fractional.
- Unresolved cost is explicit; unknown cost is never silently treated as zero.
- Transfer must conserve cost and ordinary transfer must not create artificial profit/loss.
- Reversal is linked compensation, not history rewrite.
- Backdated changes invalidate and deterministically rebuild downstream monetary state.
- Derived value/balance projections are rebuildable, not independent authoritative synchronization facts.
- Multi-write operations must become atomic; idempotency and optimistic concurrency are mandatory in their owning steps.
- Accounting posting is outside this phase.

## Argin Bridge Requirements

Bridge compatibility is mandatory from the Domain model onward. Authoritative valuation facts use durable IDs independent of SQLite row identity; preserve source movement identities; carry method/strategy version, currency and revisions; support deterministic replay; and remain compatible with future idempotency, external reference and tombstone semantics. SQLite Desktop and a future PostgreSQL/.NET server must be able to derive the same valuation from the same authoritative facts and strategy version. Live synchronization transport remains Phase 45 scope.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Inventory Valuation Domain Model | Completed |
| 3 | Valuation Strategies | Completed |
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

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, Scope and Plan Freeze

Freeze the Phase 20-complete baseline, branch, scope, ownership boundaries, Argin Bridge invariants and numbered plan.

### Step 2 — Inventory Valuation Domain Model

Define persistence-neutral valuation entries, cost layers, valuation basis, resolved/unresolved state, strategy identity/version, money/currency semantics and durable source references.

### Step 3 — Valuation Strategies

Implement versioned deterministic FIFO and moving weighted-average strategy contracts, exact arithmetic and rounding policy.

### Step 4 — Product and Warehouse Valuation Policy

Define Company-scoped strategy selection, defaults/overrides, effective dates and safe strategy-change rules.

### Step 5 — Cost Layers and Inbound Cost Basis

Implement inbound monetary basis, layer/state creation and deterministic landed-cost allocation primitives.

### Step 6 — Outflow Cost Calculation Engine

Resolve issue/outflow cost from historical stream state without over-consuming available cost basis.

### Step 7 — Transfer Cost Continuity

Carry cost atomically across transfer source/destination while conserving quantity and monetary value.

### Step 8 — Adjustment, Reversal and Reverse Valuation

Define monetary behavior for opening/adjustment/reversal and linked compensation without editing Phase 20 history.

### Step 9 — Backdated Documents and Recalculation Engine

Find the earliest affected point and deterministically recalculate downstream valuation state.

### Step 10 — Negative Stock and Cost Resolution Policy

Define blocked/deferred valuation and explicit unresolved states for negative/unknown-cost edge cases.

### Step 11 — Application and Repository Contracts

Define commands, queries, DTOs, repositories, Unit of Work, errors, recalculation ports and future ERP cost-input boundaries.

### Step 12 — Persistence, Migration and SQLite Repository

Add versioned SQLite schema, constraints, indexes and repositories for authoritative valuation facts and required projections.

### Step 13 — Atomicity, Idempotency and Optimistic Concurrency

Implement transaction boundaries, replay protection, expected-version semantics and same-stream race protection.

### Step 14 — Argin Bridge and Valuation Synchronization Contract

Freeze versioned persistence-neutral synchronization envelopes and authoritative/derived-state boundaries.

### Step 15 — Permissions, Audit and Traceability

Protect privileged monetary operations and record explainable strategy/cost/recalculation history.

### Step 16 — Valuation Query Engine and Reports

Deliver bounded on-hand value, monetary Kardex, Product/Warehouse value, layer detail, as-of, unresolved and recalculation reports.

### Step 17 — Persian RTL Inventory Valuation Workspace

Deliver Persian RTL inspection/diagnostic UI with shared design system and source drill-down.

### Step 18 — Domain and Application Tests

Cover strategy, allocation, transfer, reversal, backdated, unresolved, scope, idempotency and concurrency behavior.

### Step 19 — Repository, Migration, Bridge and Performance Tests

Cover real SQLite upgrade/restart/rollback, serialization/replay invariants, query plans and representative scale.

### Step 20 — Monorepo Validation, Documentation, Final Review and Release

Run all gates, reconcile canonical docs, review deferred scope, merge according to workflow and prepare `v0.21.0`.

## Step 1 Evidence

- Verified Phase 20-complete `main` baseline at `fa5ffa0301248dd64332f19f77181e37a8da5c6e`.
- Created `phase/21-inventory-valuation` from that baseline.
- Confirmed Phase 20 defers FIFO, moving average, cost layers, landed cost and monetary valuation reporting to Phase 21.
- Frozen this 20-step sequence with Bridge requirements from the beginning.

## Step 2 Evidence

- Added `packages/inventory/src/domain/inventory-valuation.ts`.
- Added durable valuation entry, cost-layer and valuation-basis snapshots independent of SQLite/Desktop/Purchase/Sales/Posting.
- Bound valuation to immutable Phase 20 `movementId`, document/line, transfer/reversal references and source business chronology.
- Added explicit `resolved` / `unresolved` monetary state; unresolved cost is not fabricated as zero.
- Bound valuation streams to strategy, strategy version and currency.
- Reused Platform money invariants for safe-integer monetary totals and kept exact decimal unit cost for fractional average-cost semantics.
- Added optimistic revision to valuation entries/layers and deterministic stream identity for future replay/recalculation.
- Added Step 2 domain tests in `packages/inventory/tests/inventory-valuation-domain.test.ts` for identity, resolution, sign/amount validation, currency normalization, cost-layer guard, stream identity, transfer and reversal traceability.
- Added canonical architecture record `docs/architecture/inventory-valuation-domain.md` including Argin Bridge compatibility and deferred scope.
- No live Bridge transport or persistence implementation was introduced.
- Raw executable output is not claimed here: this environment could not execute repository tests, and no workflow run exists for the current commit. The tests are committed for normal local/CI validation.

## Step 3 Evidence

- Added pure persistence-neutral strategy engine `packages/inventory/src/domain/inventory-valuation-strategy.ts`.
- Added stable version-1 strategy identity for FIFO and moving weighted average plus fixed `half-away-from-zero` monetary rounding.
- Implemented exact decimal parsing with `BigInt`; valuation arithmetic does not use binary floating-point multiplication/division for quantity or unit-cost calculations.
- Implemented deterministic FIFO receive/issue behavior with oldest-layer-first consumption, partial-layer proportional allocation and exact monetary remainder preservation.
- Implemented deterministic moving weighted-average receive/issue behavior using exact quantity plus integer monetary pool, including exact full-pool exhaustion.
- Strategy unit-cost output uses deterministic 12-decimal calculation scale with canonical trailing-zero removal; changes that alter results require a strategy-version change.
- Strategy engine rejects insufficient quantity rather than fabricating negative-stock cost; business deferred/negative-stock policy remains owned by Step 10.
- Added versioned strategy lookup and public package subpath `@argin/inventory/valuation-strategy`, so consumers do not embed strategy implementation details.
- Added `packages/inventory/tests/inventory-valuation-strategy.test.ts` covering strategy identity/version, FIFO ordering, rounding/remainder conservation, moving-average weighted basis, full exhaustion, deterministic replay and insufficient-quantity rejection.
- Added canonical architecture record `docs/architecture/inventory-valuation-strategies.md`, including Argin Bridge deterministic replay implications and boundaries for Steps 4–14.
- No Product/Warehouse policy, persisted layer repository, negative-stock policy, SQLite or live synchronization transport was introduced ahead of its owning step.
- Raw executable output is not claimed here: this environment does not provide a repository runtime and no CI workflow run is available for these commits. The committed tests must be run locally/CI as normal validation evidence.

## Change Requests

None.
