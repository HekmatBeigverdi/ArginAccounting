# Phase 21 — Inventory Valuation — Fixed Implementation Plan

## Status

Steps 1–5 are complete on `phase/21-inventory-valuation`. The fixed 20-step sequence is frozen. Step 6 — Outflow Cost Calculation Engine — is next.

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
- Inventory valuation method is an accounting policy, not a per-document option.
- Phase 21 method selection is Company-scoped: a company selects FIFO or moving weighted average as its active valuation method.
- Product/Warehouse valuation streams consume the Company policy; Phase 21 does not allow arbitrary per-document, per-product or per-warehouse method switching.
- After the first authoritative valuation exists under a policy, direct mutation of the active method is locked.
- A valuation-method change must use a controlled policy-transition workflow with an explicit effective date, immutable history, authorization and audit evidence.
- Policy transitions should normally become effective at a fiscal-year boundary; exceptional effective dates must remain explicit, validated and auditable.
- Historical valuation keeps the policy/method/version that was effective for its business chronology; changing the current policy never rewrites prior quantity facts.
- The model may remain extensible for future Product Category/Product policy scope, but such overrides are outside Phase 21 unless introduced by a later explicit Change Request.

## Inventory Valuation Policy Requirements

Phase 21 implements a first-class `InventoryValuationPolicy` persistence-neutral domain concept with Company ownership and deterministic historical resolution.

Minimum policy semantics:

- `companyId` / company scope.
- Active valuation `method`: `FIFO` or `MovingWeightedAverage`.
- Strategy/version identity used by the calculation engine.
- `effectiveFrom` business date according to the project's canonical chronology rules.
- Durable policy identity and revision/version semantics suitable for optimistic concurrency.
- Immutable/append-only policy history sufficient to resolve which policy applied at any historical valuation point.
- Controlled transition metadata including previous policy reference and mandatory change reason; actor/audit correlation belongs to later Application/Audit steps.

Required behavior:

1. A company may choose its initial valuation method before monetary valuation begins.
2. The method is not selected on inventory receipt, issue, transfer, adjustment or reversal documents.
3. Once authoritative monetary valuation has begun, settings UI and ordinary application commands must reject direct in-place method mutation.
4. A later method change creates a controlled policy transition with `effectiveFrom`; it does not silently edit the historical policy record.
5. Transition chronology is deterministic and ambiguous overlapping effective policies are rejected.
6. The preferred operational path is a transition effective from the beginning of a new fiscal year. Fiscal-boundary service validation belongs to later Application integration; the Domain requires monotonic effective chronology now.
7. Recalculation and as-of reporting resolve the policy effective for the relevant chronology rather than blindly applying the company's current method to all history.
8. Policy change is privileged and must later be represented in Audit with enough before/after context to explain financial-result differences.
9. UI must show the active method, effective date and policy history, and clearly distinguish initial configuration from a controlled method-change workflow.
10. Future Bridge/server implementations synchronize authoritative policy identity/version/effective-date facts, not a mutable local-only setting.

## Argin Bridge Requirements

Bridge compatibility is mandatory from the Domain model onward. Authoritative valuation facts use durable IDs independent of SQLite row identity; preserve source movement identities; carry method/strategy version, currency and revisions; support deterministic replay; and remain compatible with future idempotency, external reference and tombstone semantics. SQLite Desktop and a future PostgreSQL/.NET server must be able to derive the same valuation from the same authoritative facts and strategy version. Live synchronization transport remains Phase 45 scope.

Valuation policy is also part of the future synchronization contract: authoritative policy identity, Company scope, method, strategy version, `effectiveFrom`, revision and policy-transition history must be representable without relying on SQLite row IDs. Bridge replay must be able to resolve the same effective policy chronology on Desktop and Server, and mutable local settings must not override synchronized authoritative policy history.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Inventory Valuation Domain Model | Completed |
| 3 | Valuation Strategies | Completed |
| 4 | Product and Warehouse Valuation Policy | Completed |
| 5 | Cost Layers and Inbound Cost Basis | Completed |
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

Implement the Company-scoped Inventory Valuation Policy that selects FIFO or moving weighted average, carries durable policy identity/version and `effectiveFrom`, and resolves the method deterministically for Product/Warehouse valuation streams. Initial selection is configurable before monetary valuation begins; after the first authoritative valuation, direct method mutation is locked. Method changes use an explicit, authorized, audited policy transition with historical preservation and preferably a new-fiscal-year effective date. Phase 21 does not permit per-document, per-product or per-warehouse method switching; the architecture may preserve an extension seam for future category/product scope without implementing it now.

### Step 5 — Cost Layers and Inbound Cost Basis

Implement inbound monetary basis, layer/state creation and deterministic landed-cost allocation primitives.

### Step 6 — Outflow Cost Calculation Engine

Resolve issue/outflow cost from historical stream state using the policy effective for the relevant chronology, without over-consuming available cost basis.

### Step 7 — Transfer Cost Continuity

Carry cost atomically across transfer source/destination while conserving quantity and monetary value.

### Step 8 — Adjustment, Reversal and Reverse Valuation

Define monetary behavior for opening/adjustment/reversal and linked compensation without editing Phase 20 history.

### Step 9 — Backdated Documents and Recalculation Engine

Find the earliest affected point and deterministically recalculate downstream valuation state, resolving valuation policy by effective chronology rather than applying only the current Company setting.

### Step 10 — Negative Stock and Cost Resolution Policy

Define blocked/deferred valuation and explicit unresolved states for negative/unknown-cost edge cases.

### Step 11 — Application and Repository Contracts

Define commands, queries, DTOs, repositories, Unit of Work, errors, recalculation ports, controlled valuation-policy transition contracts and future ERP cost-input boundaries.

### Step 12 — Persistence, Migration and SQLite Repository

Add versioned SQLite schema, constraints, indexes and repositories for authoritative valuation facts, valuation-policy history and required projections.

### Step 13 — Atomicity, Idempotency and Optimistic Concurrency

Implement transaction boundaries, replay protection, expected-version semantics and same-stream/policy race protection.

### Step 14 — Argin Bridge and Valuation Synchronization Contract

Freeze versioned persistence-neutral synchronization envelopes and authoritative/derived-state boundaries, including Company valuation-policy identity, method, strategy version, `effectiveFrom`, revision and transition history required for deterministic cross-node replay.

### Step 15 — Permissions, Audit and Traceability

Protect privileged monetary operations and valuation-policy transitions. Record explainable strategy, effective-date, before/after policy, cost and recalculation history so a method change and its financial impact can be traced.

### Step 16 — Valuation Query Engine and Reports

Deliver bounded on-hand value, monetary Kardex, Product/Warehouse value, layer detail, as-of, unresolved and recalculation reports. As-of queries must resolve the valuation policy historically effective for the requested chronology.

### Step 17 — Persian RTL Inventory Valuation Workspace

Deliver Persian RTL inspection/diagnostic UI with shared design system and source drill-down. The workspace/settings surface must show the active Company valuation method, effective date and policy history; distinguish initial setup from controlled method transition; disable arbitrary direct switching after valuation has begun; and surface a clear financial-impact warning for policy changes.

### Step 18 — Domain and Application Tests

Cover strategy, allocation, transfer, reversal, backdated, unresolved, scope, idempotency and concurrency behavior. Add explicit tests for initial Company method selection, lock-after-first-valuation, rejection of document/product/warehouse method overrides, non-overlapping effective policy chronology, controlled transitions, historical policy resolution and audit-triggering application paths.

### Step 19 — Repository, Migration, Bridge and Performance Tests

Cover real SQLite upgrade/restart/rollback, policy-history persistence, serialization/replay invariants, Bridge policy-version/effective-date round-trips, query plans and representative scale.

### Step 20 — Monorepo Validation, Documentation, Final Review and Release

Run all gates, reconcile canonical docs (including Inventory Valuation Policy governance), review deferred scope, merge according to workflow and prepare `v0.21.0`.

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

## Step 4 Evidence

- Added `packages/inventory/src/domain/inventory-valuation-policy.ts` as a persistence-neutral Company-scoped accounting-policy model.
- Implemented initial Company policy creation with durable identity, FIFO/Moving Average method, strategy version, currency, `effectiveFrom` and revision.
- Implemented direct-mutation lock contract once authoritative monetary valuation exists.
- Implemented append-only controlled policy transitions with new durable identity, strictly later effective date, `previousPolicyId`, mandatory change reason and revision progression.
- Implemented deterministic policy resolution by Company + movement business date; Product/Warehouse IDs remain valuation context and do not override the Company method.
- Implemented policy-history integrity validation for first-record semantics, monotonic chronology, overlap rejection and predecessor-chain validation.
- Added public package subpath `@argin/inventory/valuation-policy` without coupling the policy model to SQLite or Desktop.
- Added `packages/inventory/tests/inventory-valuation-policy.test.ts` covering initial setup, shared Company policy across Product/Warehouse streams, historical resolution, direct-mutation lock, transition chronology/reason validation, overlap detection and missing-policy behavior.
- Added canonical architecture record `docs/architecture/inventory-valuation-policy.md` with CR-21-001 governance and Argin Bridge implications.
- An initial Product/Warehouse override draft was detected during Step 4 review and corrected before completion because it contradicted approved CR-21-001; final Step 4 implementation is Company-scoped only.
- Fiscal-year-boundary service validation, authorization/Audit correlation, persistence and UI remain in their owning later steps.
- Raw executable test output is not claimed here unless local/CI validation is actually observed.

## Step 5 Evidence

- Added persistence-neutral inbound-cost model `packages/inventory/src/domain/inventory-inbound-cost.ts`.
- Added durable basis-line identity bound to Phase 20 `movementId`, Product, Warehouse, exact base quantity, base monetary cost, currency and optional explicit allocation weight.
- Added traceable landed-cost components with durable component/source identity and explicit `quantity`, `value` or `weight` allocation method.
- Implemented deterministic proportional allocation using decimal/`BigInt` arithmetic; currency mismatch, missing weight, zero aggregate allocation basis and invalid amounts are rejected rather than guessed.
- Implemented exact smallest-unit conservation: each landed-cost component's allocations sum exactly to the authoritative component amount, with deterministic remainder assigned to the final eligible line in caller-supplied canonical order.
- Implemented resolved inbound basis with `baseCost + landedCost = totalCost` and deterministic 12-decimal unit-cost derivation.
- Added `inventoryValuationInboundInputFromCostBasis` so the same resolved basis feeds Step 3 FIFO or moving-average strategy contracts; FIFO callers additionally supply durable layer identity.
- Added public package subpath `@argin/inventory/inbound-cost` and corrected root package exports so Step 3/4/5 public contracts are available consistently.
- Added `packages/inventory/tests/inventory-inbound-cost.test.ts` covering no-landed-cost basis, quantity/value/weight allocation, multiple traceable components, exact monetary conservation, strategy-input mapping, currency mismatch and missing-weight rejection.
- Added canonical architecture record `docs/architecture/inventory-inbound-cost-basis.md` including Purchase/ERP ownership boundary and Argin Bridge deterministic replay requirements.
- Purchase invoice/vendor/freight workflow, persistence, authorization/Audit, outflow calculation, transfer, recalculation and posting remain in their owning later phases/steps.
- Raw executable test output is not claimed here unless local/CI validation is actually observed.

## Change Requests

### CR-21-001 — Company-scoped Inventory Valuation Policy Governance

- Date: 2026-09-11
- Status: Approved by owner
- Reason: Phase 21 must treat FIFO / Moving Weighted Average selection as a controlled accounting policy rather than a freely mutable document setting.
- Step sequence impact: none; the frozen 20-step titles and order remain unchanged.
- Requirements added:
  - Company-scoped initial method selection between FIFO and Moving Weighted Average.
  - No per-document method selection and no Phase 21 Product/Warehouse override behavior.
  - Direct method mutation locks after authoritative monetary valuation begins.
  - Later changes use a controlled policy transition with `effectiveFrom`, immutable history, authorization and Audit.
  - Prefer fiscal-year-boundary transitions while keeping any exceptional effective date explicit and deterministic.
  - Historical/recalculated valuation resolves the policy effective for the relevant chronology.
  - UI exposes active method/effective date/history and separates initial configuration from method transition.
  - Argin Bridge contracts preserve policy identity, method, strategy version, effective date, revision and history for deterministic replay across Desktop and future Server.
  - Architecture remains extensible for future Product Category/Product scope, but such overrides are deferred beyond Phase 21 unless explicitly approved later.