# Phase 23 — Purchase Posting & Accounting Integration — Fixed Implementation Plan

## Status

Steps 1–2 are complete. Steps 3–30 are not started.

## Governance

The 30 step titles, order, scope and ownership boundaries are frozen unless an explicitly approved Change Request is recorded in this canonical phase record. Owner acceptance and executable validation evidence remain separate.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Roadmap](../../ROADMAP.md)
- [Phase 13 — Journal Voucher Engine](phase-13-journal-voucher-engine.md)
- [Phase 15 — Journal Lifecycle](phase-15-journal-lifecycle.md)
- [Phase 20 — Inventory Documents](phase-20-inventory-documents-plan.md)
- [Phase 21 — Inventory Valuation](phase-21-inventory-valuation-plan.md)
- [Phase 22 — Purchase Workflow](phase-22-purchase-workflow-plan.md)
- [Commercial Pricing and Inventory Valuation Boundary](../architecture/commercial-pricing-and-valuation-boundary.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [Posting Engine](../accounting/posting-engine.md)
- [ADR-0023 — Purchase Posting Boundary](../adr/ADR-0023-purchase-posting-boundary.md)
- [Purchase Posting Domain Model](../architecture/purchase-posting-domain-model.md)

## Baseline and Release Target

- Baseline branch: `main`.
- Baseline commit: `7f1b615e8e406befa0cf3967134e99d76b456a27`.
- Phase branch: `phase/23-purchase-posting`.
- Target version: `0.23.0` / `v0.23.0`.
- Phase 23 depends on the Phase 22 Purchase state already promoted to `main`.
- The historical `phase/22-purchase-workflow` branch is behind `main` and is not the Phase 23 baseline.

## Mission

Phase 23 converts authoritative Purchase commercial facts and authoritative Inventory Valuation results into deterministic, balanced, traceable and idempotent accounting posting requests and Journal Vouchers.

The phase does not create a second Purchase-price store, does not own quantity movement, and does not recalculate FIFO or Moving Weighted Average.

Canonical dependency direction:

```text
Phase 22 Purchase commercial facts
              +
Phase 20 Inventory movement identity
              +
Phase 21 authoritative valuation outputs
              ↓
Phase 23 Purchase Posting
              ↓
Accounting / Journal Engine
              ↓
General Ledger
```

## Ownership Boundaries

### Phase 23 owns

- Purchase accounting-recognition semantics.
- Supplier payable accounting effects.
- Recoverable Purchase VAT accounting effects.
- Configured Inventory / GRNI / Purchase expense treatment.
- Purchase charge / landed-cost accounting classification at the posting boundary.
- Purchase return and correction accounting effects.
- Posting-source identity and deterministic posting intent.
- Draft posting construction and balance validation.
- Idempotent accounting posting orchestration.
- Reversal linkage for Purchase-generated accounting.
- Purchase-to-ledger traceability and reconciliation.
- Purchase-posting Bridge contracts.

### Phase 23 consumes but does not own

- Supplier Invoice and other Purchase commercial facts from Phase 22.
- Inventory movement identities and quantity authority from Phase 20.
- FIFO / Moving Weighted Average cost results and valuation chronology from Phase 21.
- Accounts and accounting dimensions from Accounting Core.
- Fiscal period status and locks from Fiscal Management.
- Journal Voucher creation/lifecycle contracts from Phases 13 and 15.
- Shared Audit, Security, Approval and concurrency infrastructure.

### Explicitly out of scope

- Sales Workflow and Sales Posting.
- Treasury receipt/payment posting.
- Bank and cash reconciliation.
- Reimplementation of FIFO or Moving Weighted Average.
- Re-entry or duplication of supplier purchase price.
- Direct mutation of Purchase, Inventory or Valuation-owned tables.
- Live remote synchronization transport, acknowledgements and conflict resolution.
- PostgreSQL server implementation.
- Iranian Taxpayer System submission.
- General-purpose Posting Rules platform owned by future Phase 29, except the minimum Purchase-specific rule contracts required to keep Phase 23 deterministic and forward-compatible.

## Core Invariants

- Purchase price authority remains Phase 22.
- Inventory quantity authority remains Phase 20.
- Inventory cost/valuation authority remains Phase 21.
- Phase 23 creates accounting effects only from durable upstream facts.
- Supplier Invoice accounting must never require the operator to re-enter normal Purchase price, discounts, charges or VAT already owned by Purchase.
- Valuation-derived Inventory effects must use authoritative valuation output, not selling price and not independently recomputed Purchase cost.
- `purchase-order` is non-posting unless a future explicitly approved rule states otherwise.
- Confirmed/eligible source state is required before posting.
- Every generated Journal Voucher must satisfy total debit = total credit before commit.
- Missing required account mapping fails explicitly; no silent fallback account is permitted.
- Posting is atomic: either the complete accounting effect is committed or none of it is.
- Posting is idempotent for the same durable source identity, source version/revision, posting purpose and payload fingerprint.
- Replay of an already committed identical posting returns the committed result and never creates a duplicate voucher.
- A changed source revision or payload under the same incompatible idempotency identity must conflict rather than silently overwrite history.
- Posted accounting history is immutable in place.
- Returns, corrections and reversals create linked compensating accounting facts rather than editing posted Journal Lines.
- Fiscal eligibility is checked at posting time against current authoritative Fiscal locks, while historical source scope remains traceable.
- Company and Branch scope must agree across source, resolved accounts/dimensions and generated Journal Voucher.
- Posting rules resolve accounts; UI must not become an accounting-rule engine.
- Purchase Posting may consume Inventory Valuation results but must not mutate FIFO layers, MWA state or Cost Inputs.
- Reconciliation must support source → posting → journal and journal → posting → source navigation.
- Durable identities must not depend on SQLite row IDs.
- Argin Bridge payloads synchronize authoritative Purchase Posting facts/commands/results and source provenance, not rebuildable UI summaries.
- Bridge envelopes must preserve Company, Branch, source identity/version, correlation, causation, request/operation identity and deterministic payload fingerprint.
- Desktop remains offline-first; SQLite is an adapter, not domain authority.

## Argin Bridge Rule

Phase 23 follows the Argin Bridge principle from Step 1.

The local implementation must be usable today with SQLite while keeping contracts serializable and persistence-neutral for the future .NET/PostgreSQL synchronization path.

Canonical shape:

```text
Purchase / Valuation authoritative facts
              ↓
PurchasePostingFact / PostingRequest
              ↓
SQLite Desktop implementation
              ↓
Argin Bridge contract
              ↓
future ASP.NET Core / PostgreSQL runtime
```

Bridge design requirements:

- durable IDs instead of SQLite row IDs;
- explicit schema/version metadata;
- source type + source ID + source version/revision;
- Company and Branch scope;
- correlation ID and causation ID;
- request ID, operation ID and idempotency key;
- deterministic payload fingerprint;
- occurred/effective timestamps with UTC system timestamps;
- append-only correction/reversal lineage;
- no synchronized rebuildable totals, balances or UI projections as independent authority.

Live transport is not implemented in Phase 23.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Purchase Posting Domain Model | Completed |
| 3 | Purchase Posting Facts and Snapshots | Not started |
| 4 | Source Identity and Reference Contracts | Not started |
| 5 | Purchase Posting Event Classification | Not started |
| 6 | Posting Rules and Account Resolution | Not started |
| 7 | Supplier Invoice Posting Rules | Not started |
| 8 | Purchase Tax Posting | Not started |
| 9 | Purchase Charges Posting | Not started |
| 10 | Purchase Return Posting | Not started |
| 11 | Purchase Correction Posting | Not started |
| 12 | Inventory and Valuation Integration | Not started |
| 13 | Draft Journal Generation and Balancing | Not started |
| 14 | Atomic Journal Posting | Not started |
| 15 | Idempotency and Replay Safety | Not started |
| 16 | Version and Concurrency Control | Not started |
| 17 | Controlled Posting Reversal | Not started |
| 18 | Fiscal Scope and Period Locks | Not started |
| 19 | Branch and Accounting Dimensions | Not started |
| 20 | Persistence and SQLite Migration | Not started |
| 21 | Repository, Reader and Unit of Work | Not started |
| 22 | Argin Bridge Posting Contracts | Not started |
| 23 | Permissions, Audit and Traceability | Not started |
| 24 | Purchase-to-Ledger Reconciliation | Not started |
| 25 | Posting UI and Trace Viewer | Not started |
| 26 | Domain and Application Tests | Not started |
| 27 | End-to-End SQLite/Purchase/Valuation/Posting Tests | Not started |
| 28 | Bridge, Replay, Rollback and Failure Tests | Not started |
| 29 | Documentation, Step Status and Phase Evidence | Not started |
| 30 | Release, Merge and Phase Closure | Not started |

## Fixed Execution Sequence

1. Baseline, Branch, Scope and Plan Freeze
2. Purchase Posting Domain Model
3. Purchase Posting Facts and Snapshots
4. Source Identity and Reference Contracts
5. Purchase Posting Event Classification
6. Posting Rules and Account Resolution
7. Supplier Invoice Posting Rules
8. Purchase Tax Posting
9. Purchase Charges Posting
10. Purchase Return Posting
11. Purchase Correction Posting
12. Inventory and Valuation Integration
13. Draft Journal Generation and Balancing
14. Atomic Journal Posting
15. Idempotency and Replay Safety
16. Version and Concurrency Control
17. Controlled Posting Reversal
18. Fiscal Scope and Period Locks
19. Branch and Accounting Dimensions
20. Persistence and SQLite Migration
21. Repository, Reader and Unit of Work
22. Argin Bridge Posting Contracts
23. Permissions, Audit and Traceability
24. Purchase-to-Ledger Reconciliation
25. Posting UI and Trace Viewer
26. Domain and Application Tests
27. End-to-End SQLite/Purchase/Valuation/Posting Tests
28. Bridge, Replay, Rollback and Failure Tests
29. Documentation, Step Status and Phase Evidence
30. Release, Merge and Phase Closure

## Step 1 — Baseline, Branch, Scope and Plan Freeze

### Completed work

- Verified the canonical project Roadmap places Purchase Posting at Phase 23.
- Verified Phase 22 Purchase Workflow is already promoted to `main`.
- Compared `phase/22-purchase-workflow` to `main`; it is behind and has no commits ahead, therefore it is not used as the new baseline.
- Frozen the Phase 23 baseline at `main@7f1b615e8e406befa0cf3967134e99d76b456a27`.
- Created `phase/23-purchase-posting` from that exact baseline.
- Frozen the 30-step execution plan and ownership boundaries.
- Defined the accounting-source dependency direction across Purchase, Inventory, Valuation and Journal.
- Defined Argin Bridge constraints at phase inception rather than deferring them to the Bridge-specific implementation step.
- Recorded the architectural decision in ADR-0023.

### Exit criteria

- [x] Exact baseline commit recorded.
- [x] Dedicated phase branch created from the exact baseline.
- [x] Phase title and semantic release target defined.
- [x] Fixed step sequence recorded.
- [x] In-scope ownership defined.
- [x] Explicit non-scope defined.
- [x] Cross-module authority boundaries defined.
- [x] Journal immutability/reversal rule defined.
- [x] Idempotency/replay baseline defined.
- [x] Fiscal/Branch scope baseline defined.
- [x] Argin Bridge requirements defined.
- [x] ADR created.
- [x] No production code or schema change introduced in Step 1.

### Validation evidence

Step 1 is a governance/architecture bootstrap step. It intentionally introduces no runtime code and no database migration; therefore no runtime test result is claimed for this step.

Repository evidence:

- `main` baseline: `7f1b615e8e406befa0cf3967134e99d76b456a27`.
- `phase/22-purchase-workflow` vs `main`: 0 commits ahead and 6 commits behind at Step 1 review.
- Phase branch: `phase/23-purchase-posting`.

Full monorepo validation remains a later phase gate and must be executed and recorded when code changes begin and again before release.


## Step 2 — Purchase Posting Domain Model

### Completed work

- Introduced a dedicated `@argin/purchase-posting` bounded-context package instead of adding accounting ownership to `@argin/purchase`.
- Added the persistence-neutral `PurchasePostingAggregate`.
- Frozen the base status vocabulary: `draft`, `prepared`, `posted`, `reversed`.
- Added durable `postingId`, Company and Branch identity, Journal linkage, aggregate version and canonical UTC timestamps.
- New aggregates begin as `draft`, version `1`, with no Journal Voucher link.
- Rehydration validates identity, status, version, timestamp chronology and Journal linkage invariants.
- Draft/prepared state cannot carry a Journal Voucher; posted/reversed state must carry the Accounting-owned Journal Voucher identity.
- Added structured Purchase Posting domain errors.
- Added public package exports and a focused domain-model test suite.
- Registered the new workspace package in `pnpm-lock.yaml`.
- Added the canonical architecture document `docs/architecture/purchase-posting-domain-model.md`.
- Kept source facts, source identity, posting-event classification, Posting Rules, accounting formulas, persistence and Bridge envelopes deferred to their frozen later steps.

### Exit criteria

- [x] Purchase Posting is isolated from Purchase commercial ownership.
- [x] Domain model has durable identity independent of SQLite row IDs.
- [x] Company/Branch scope is present at aggregate root.
- [x] Base lifecycle vocabulary is explicit.
- [x] Journal-link state invariants are explicit.
- [x] Aggregate version is validated as a positive safe integer.
- [x] Canonical UTC timestamp and chronology invariants are enforced.
- [x] Aggregate construction/rehydration is persistence-neutral.
- [x] Domain errors are structured and exported.
- [x] Focused tests cover creation, rehydration and invalid-state paths.
- [x] Workspace lock importer is registered.
- [x] Step 3–22 responsibilities are not prematurely implemented.

### Validation evidence

Observed in the available execution environment:

- Node.js `v22.16.0` focused runtime verification: **6 tests passed, 0 failed**.
- TypeScript domain-source verification with `tsc 5.8.3`: **exit code 0** for the Step 2 source files.
- A full package typecheck including Node test typings could not be executed in this environment because `@types/node` is not installed locally here. The repository package declares `@types/node ^20` and the workspace lock importer is registered for normal repository installation.
- Full monorepo validation remains a later quality gate; no unobserved CI/full-build PASS is claimed.

### Files introduced or changed

- `packages/purchase-posting/package.json`
- `packages/purchase-posting/tsconfig.json`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/domain/purchase-posting.ts`
- `packages/purchase-posting/tests/purchase-posting-domain-model.test.ts`
- `docs/architecture/purchase-posting-domain-model.md`
- `pnpm-lock.yaml`
