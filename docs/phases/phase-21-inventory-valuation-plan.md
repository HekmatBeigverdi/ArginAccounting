# Phase 21 — Inventory Valuation — Fixed Implementation Plan

## Status

Steps 1–7 are complete on `phase/21-inventory-valuation`. The fixed 20-step sequence is frozen. Step 8 — Adjustment, Reversal and Reverse Valuation — is next.

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
- Backdated changes invalidate downstream monetary state and are deterministically recalculated in Step 9.
- Derived value/balance projections are rebuildable and are not independently authoritative synchronization facts.
- Accounting journal posting is outside Phase 21.

## Argin Bridge Requirements

Authoritative valuation facts and policy history use durable IDs independent of SQLite row identity. Source movement IDs, transfer/reversal references, strategy version, currency, revisions and effective chronology must survive future synchronization. SQLite Desktop and future PostgreSQL/.NET Server implementations must derive identical valuation from identical authoritative facts and algorithm versions. Live transport, acknowledgements, retries and distributed conflict handling remain Phase 45 scope.

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

### Step 1
Verified Phase 20-complete `main`, created `phase/21-inventory-valuation`, confirmed Phase 20 deferrals and froze the 20-step plan with Bridge requirements.

### Step 2
Added persistence-neutral valuation entries, cost layers/basis, explicit resolved/unresolved state, strategy identity/version, durable Phase 20 source references, monetary invariants and focused domain tests.

### Step 3
Added deterministic FIFO and Moving Weighted Average strategies, exact `BigInt` decimal arithmetic, fixed rounding/version rules, FIFO remainder conservation, moving-average pool semantics and strategy tests.

### Step 4
Added Company-scoped valuation policy with `effectiveFrom`, append-only transitions, direct-mutation lock, deterministic historical resolution and policy-history integrity. CR-21-001 prohibits Phase 21 Product/Warehouse method overrides.

### Step 5
Added inbound cost basis, durable landed-cost components, deterministic quantity/value/weight allocation, exact monetary conservation, traceable sources and strategy-input mapping.

### Step 6
Added ordinary-outflow cost engine resolving historical Company policy, validating method/state compatibility, calculating FIFO or Moving Average cost, returning FIFO layer traceability, and deferring Transfer/Reversal semantics to Steps 7/8.

### Step 7
- Added `packages/inventory/src/domain/inventory-transfer-cost.ts` as a persistence-neutral transfer valuation engine.
- Validates Phase 20 source/destination movement pairs: same transfer/document/line/Product/chronology, opposite equal quantity, different stock keys and no reversal identity.
- Resolves the same Company policy for both transfer sides and rejects policy/method/version/currency divergence.
- FIFO transfer consumes exact source-layer portions and creates caller-identified durable destination layers with exactly the same quantity and monetary cost; existing destination FIFO layers retain their earlier order.
- Moving Weighted Average transfer removes the exact integer monetary amount from the source pool and adds that exact amount to the destination pool without recomputing from rounded unit cost.
- Enforces monetary conservation: `sourceTotalCost + destinationTotalCost = 0` and exposes `netTotalCost = 0`, preventing artificial transfer P&L.
- Preserves transfer ID, both movement IDs, policy identity/version, source FIFO consumptions and destination layer creation for future Kardex/Audit/Bridge traceability.
- Added public package subpath `@argin/inventory/transfer-cost`.
- Added `packages/inventory/tests/inventory-transfer-cost.test.ts` covering FIFO continuity, destination ordering, Moving Average exact carry, non-conserving pair rejection, destination layer identity validation and historical-policy use.
- Added `docs/architecture/inventory-transfer-cost-continuity.md` with deterministic replay and Argin Bridge requirements.
- Transfer reversal, backdated recalculation, negative-stock resolution and persistence/transaction orchestration remain in Steps 8–13.
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
