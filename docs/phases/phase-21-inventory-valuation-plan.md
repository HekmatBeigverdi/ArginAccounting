# Phase 21 — Inventory Valuation — Fixed Implementation Plan

## Status

Steps 1–19 are complete on `phase/21-inventory-valuation`. Step 17 — Persian RTL Inventory Valuation Workspace — was reopened by CR-21-002, completed with the inbound-cost-entry path, and explicitly owner-accepted on 2026-09-13. The fixed 20-step sequence remains frozen. Step 20 — Monorepo Validation, Documentation, Final Review and Release — is next.

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
- [Inventory Valuation Permissions, Audit and Traceability](../architecture/inventory-valuation-permissions-audit-traceability.md)
- [Inventory Valuation Query Engine and Reports](../architecture/inventory-valuation-query-reports.md)
- [Inventory Valuation Persian RTL Workspace](../architecture/inventory-valuation-persian-rtl-workspace.md)
- [Phase 21 Domain and Application Test Matrix](../testing/phase-21-domain-application-tests.md)
- [Phase 21 Repository, Migration, Bridge and Performance Test Matrix](../testing/phase-21-repository-migration-bridge-performance-tests.md)

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
- Privileged valuation mutations require operation-specific permission and append-only audit evidence; traceability preserves Movement/Cost Input/Policy provenance without fabricating missing monetary values.
- Monetary reports are bounded, Company/Branch scoped, preserve unresolved cost explicitly, and never become synchronization truth.
- The Persian RTL workspace consumes report/trace contracts and does not reimplement valuation arithmetic in the UI.
- Every confirmed inbound quantity movement that requires monetary valuation has an explicit resolvable cost-input path. Missing cost is `unresolved`, never zero.
- Manual inbound-cost entry is a valuation mutation linked to the immutable Phase 20 movement; it never edits confirmed quantity facts.
- Accounting journal posting is outside Phase 21.

## Argin Bridge Requirements

Authoritative valuation facts and policy history use durable IDs independent of SQLite row identity. Phase 20 movement IDs, policy IDs, cost-basis IDs, strategy version, currency, stream revisions, request identities and effective chronology must survive future synchronization. Phase 21 valuation sync uses versioned envelopes for policy history and resolved cost inputs; derived entries, cost layers, state projections and report rows are rebuilt at the destination. SQLite Desktop and future PostgreSQL/.NET Server implementations must derive identical valuation from identical authoritative facts and algorithm versions. Live transport, acknowledgements, dependency queues, retries and distributed conflict resolution remain Phase 45 scope.

Manual or future ERP/Purchase-sourced inbound Cost Inputs use durable source identity and remain authoritative Bridge facts. A manually entered cost therefore synchronizes as the same authoritative resolved Cost Input as a future server-created cost input, rather than as a UI-only or SQLite-only field.

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
| 15 | Permissions, Audit and Traceability | Completed |
| 16 | Valuation Query Engine and Reports | Completed |
| 17 | Persian RTL Inventory Valuation Workspace | Completed — re-completed and owner-accepted after CR-21-002 |
| 18 | Domain and Application Tests | Completed |
| 19 | Repository, Migration, Bridge and Performance Tests | Completed |
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
Deliver Persian RTL valuation inspection/diagnostic UI, source drill-down and Company policy/history surfaces, plus the bounded mutation path required to resolve inbound movements that have no monetary basis.

#### Step 17 completion addendum — Inbound Cost Entry

CR-21-002 requires confirmed inbound movements to have a bounded monetary-resolution path without making Phase 20 quantity documents price-editable. The completed path preserves these requirements:

1. confirmed inbound movements can be identified as resolved/unresolved without substituting zero;
2. the Persian RTL valuation workspace exposes inbound-cost entry/correction rather than editing the confirmed receipt quantity fact;
3. monetary data follows exact Step 5 rules and explicit currency semantics;
4. mutation is linked to durable `movementId` and uses valuation application/concurrency boundaries;
5. operation-specific cost-input permission is distinct from view access;
6. request identity, optimistic concurrency and replay rules from Step 13 remain mandatory;
7. corrections are auditable and trigger deterministic downstream recalculation instead of patching derived Entry/Layer/State rows;
8. the same authoritative Cost Input feeds FIFO or Moving Weighted Average according to effective Company policy;
9. unresolved cost remains visible as unresolved and never becomes fabricated zero;
10. manual input remains compatible with future Purchase/ERP sources and Argin Bridge authoritative Cost Input envelopes.

The owner explicitly accepted Step 17 after the CR-21-002 implementation on 2026-09-13. This acceptance closes the reopened step without removing the Change Request history.

### Step 18 — Domain and Application Tests
Cover strategy, allocation, transfer, reversal, backdated, unresolved, scope, idempotency and concurrency behavior, including the inbound-cost-entry Application mutation and correction/recalculation path introduced by CR-21-002.

### Step 19 — Repository, Migration, Bridge and Performance Tests
Cover real SQLite upgrade/restart/rollback, policy/history persistence, Cost Input persistence/correction, serialization/replay invariants, Bridge round-trips, query plans and representative scale.

### Step 20 — Monorepo Validation, Documentation, Final Review and Release
Run all gates, reconcile canonical docs, review deferred scope, merge according to workflow and prepare `v0.21.0`.

## Step Evidence

### Steps 1–6
- Froze Phase 21 scope/baseline and added valuation domain snapshots, FIFO/MWA strategies, Company policy, inbound/landed-cost basis and ordinary outflow cost calculation.
- Exact arithmetic, strategy versioning, policy-effective chronology and explicit unresolved cost semantics are preserved.

### Step 7
- Added transfer cost continuity for FIFO and Moving Weighted Average with exact quantity/monetary conservation.

### Step 8
- Added monetary opening/adjustment behavior and linked reverse valuation preserving original monetary effect and policy identity.

### Step 9
- Added deterministic recalculation planning/replay from earliest affected chronology across Company + Product warehouses; policy changes invalidate Company-wide from `effectiveFrom`.

### Step 10
- Added versioned negative-stock/cost-resolution policy; missing/insufficient/upstream cost remains explicit unresolved state.

### Step 11
- Added valuation Commands, Queries, repositories, UoW, recalculation port and ERP/Purchase/Sales cost-input boundary.

### Step 12
- Added SQLite persistence for policy history, resolved cost inputs, valuation entries, FIFO layers and dated state projection; derived state remains rebuildable.

### Step 13
- Added durable idempotency, stream revisions, compare-and-swap and guarded mutation orchestration using one transaction order: replay lookup -> stream CAS -> mutation -> durable outcome.

### Step 14
- Added versioned Argin Bridge envelopes for authoritative Policy history and resolved Cost Inputs; Phase 20 movement sync remains sole quantity channel; derived valuation projections are excluded from authoritative sync.

### Step 15
- Added operation-specific valuation permissions, shared Audit integration and persistence-neutral traceability connecting Movement/Cost Input/Policy to Valuation Entry.

### Step 16
- Added bounded As-of value, monetary Kardex, current FIFO layer detail, unresolved diagnostics and recalculation/currentness status contracts/SQLite reader.
- Current FIFO layers are explicitly not historical As-of layer state.
- Raw executable test output is not claimed unless local/CI validation is actually observed.

### Step 17
- Added Desktop route `/inventory/valuation`, Persian RTL valuation workspace, Solar Hijri filters, As-of value, monetary Kardex, FIFO layers, unresolved diagnostics, policy history, currentness and provenance drill-down.
- Added explicit UI guidance distinguishing Bridge authoritative facts from rebuildable report totals/running balances.
- CR-21-002 subsequently reopened Step 17 to add end-to-end manual inbound-cost resolution/correction for confirmed inbound movements using the existing valuation boundaries rather than editing Phase 20 quantity facts.
- The CR-21-002 path is now owner-accepted; Step 17 is re-completed while the Change Request remains recorded below.
- Raw executable test output is not claimed unless local/CI validation is actually observed.

### Step 18
- Reviewed the existing Phase 21 Domain/Application suite rather than duplicating already-covered strategy/policy/transfer/recalculation cases.
- Added `packages/inventory/tests/inventory-valuation-guarded-mutation.test.ts` with direct coverage of `executeInventoryValuationGuardedMutation()`.
- Guarded-mutation tests verify transaction ordering, exact replay short-circuit without CAS/mutation, request/fingerprint conflict before CAS, UTC normalization and failure rollback without a successful idempotency outcome record.
- Added `docs/testing/phase-21-domain-application-tests.md` as the canonical coverage matrix for FIFO, MWA, inbound/landed cost, policy, outflow, transfer, reversal, backdated recalculation, unresolved cost, Application contracts, idempotency/concurrency, authorization/trace and Bridge contracts.
- CR-21-002 is explicitly mapped to persistence-neutral inbound-cost arithmetic, guarded mutation/idempotency and deterministic recalculation tests. Concrete SQLite persistence/correction belongs to Step 19.
- Test definitions are committed, but executable local/CI success is not claimed unless output is actually observed.

### Step 19
- Added a Node 22 `node:sqlite` integration harness that executes the repository migration SQL against real SQLite rather than validating SQL text only.
- Added upgrade coverage from the Phase 20 database boundary (migration 27) through migrations 28/29 and verifies pre-existing data remains intact.
- Added database-boundary validation for append-only valuation policy history, FIFO-layer cascade behavior and the Product chronology index through `EXPLAIN QUERY PLAN`.
- Added a real multi-connection SQLite lock test proving `BEGIN IMMEDIATE` excludes a second concurrent writer and rollback leaves no committed probe row.
- Added real SQLite Cost Input persistence tests for manual resolution, deterministic monetary rounding, FIFO Entry/Layer creation, exact idempotent replay and revision-based correction/CAS rejection.
- Added forced durable-idempotency failure inside the transaction and verifies Cost Input, Entry, Layer and idempotency writes all roll back atomically.
- Added Bridge round-trip coverage built from a persisted authoritative Cost Input, verifying quantity, monetary totals, entity revision, Product stream revision and movement dependency survive JSON serialization without drift.
- Added representative-scale coverage with 10,000 valuation entries and verifies bounded Product chronology reads continue to use `idx_inventory_valuation_entries_company_product_chronology`.
- Added `docs/testing/phase-21-repository-migration-bridge-performance-tests.md` as the canonical Step 19 test matrix and scope boundary.
- Live distributed Bridge transport/acknowledgements/conflict resolution remain Phase 45; Step 19 validates the Phase 21 persistence and envelope boundary only.
- Test definitions are committed and wired into the package test glob; executable local/CI success is not claimed unless output is actually observed.

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

### CR-21-002 — End-to-End Inbound Cost Entry for Confirmed Receipts
- Date: 2026-09-13
- Status: Approved; implementation owner-accepted and Step 17 re-completed on 2026-09-13.
- Trigger: owner acceptance testing showed that confirmed inventory receipts accepted quantity but originally exposed no end-to-end UI/application path for entering the monetary basis required by valuation.
- Step sequence impact: none; all 20 step titles/order remain unchanged.
- Ownership impact: Step 17 was reopened only to complete the bounded Cost Input mutation/correction UX and Application wiring. Existing Step 5/9/13/14/15 contracts and invariants remain authoritative and are reused rather than bypassed.
- Receipt/document quantity remains owned by Phase 20 and immutable after confirmation; price is not added as an editable quantity-document field.
- Missing cost remains explicit `unresolved`; zero is never substituted.
- Cost entry/correction uses durable `movementId`, Cost Input identity, permission, idempotency, optimistic concurrency, Audit, traceability and deterministic recalculation.
- The same resolved Cost Input feeds FIFO or Moving Weighted Average according to Company policy effective for chronology.
- Manual cost entry is a standalone/fallback source; future Purchase/ERP automation must use the same bounded authoritative Cost Input contract.
- Step 18 covers persistence-neutral semantics; Step 19 validates the concrete SQLite persistence/correction, migration and Bridge serialization boundary.