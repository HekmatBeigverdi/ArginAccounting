# Phase 23 — Purchase Posting & Accounting Integration — Fixed Implementation Plan

## Status

Steps 1–8 are complete. Steps 9–30 are not started.

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
- [Purchase Posting Facts and Snapshots](../architecture/purchase-posting-facts-and-snapshots.md)
- [Purchase Posting Source Identity](../architecture/purchase-posting-source-identity.md)
- [Purchase Posting Event Classification](../architecture/purchase-posting-event-classification.md)
- [Purchase Posting Rules and Account Resolution](../architecture/purchase-posting-rules-and-account-resolution.md)
- [Supplier Invoice Posting Rules](../architecture/supplier-invoice-posting-rules.md)
- [Purchase Tax Posting](../architecture/purchase-tax-posting.md)

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
| 3 | Purchase Posting Facts and Snapshots | Completed |
| 4 | Source Identity and Reference Contracts | Completed |
| 5 | Purchase Posting Event Classification | Completed |
| 6 | Posting Rules and Account Resolution | Completed |
| 7 | Supplier Invoice Posting Rules | Completed |
| 8 | Purchase Tax Posting | Completed |
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


## Step 3 — Purchase Posting Facts and Snapshots

### Completed work

- Added immutable `PurchasePostingFactSnapshot` as the accounting-recognition input boundary.
- Captured durable Company/Branch/Fiscal scope, Purchase document identity/version, document type/status, document number, business date and capture timestamp.
- Added historical Supplier snapshot including Company scope and Iranian identity/tax fields required for traceability.
- Added Product/Service line snapshots with stable Purchase line identity/position, line kind, base quantity and historical item identity.
- Added immutable commercial amount snapshots for gross, discount, net-after-discount, charges, tax base, tax and grand total.
- Snapshot validation verifies arithmetic integrity only; it does not re-run Purchase pricing or create a second editable price store.
- Document totals must equal the exact aggregate of captured line totals.
- Added optional multi-movement Inventory Valuation provenance through `valuations[]` for stock-product lines.
- Valuation provenance captures Company, valuation entry, movement, Inventory document/line, Product, Warehouse, policy, FIFO/MWA method, strategy version, quantity, unit cost, total cost and valuation currency.
- Multiple valuation movements are supported for one Purchase line; duplicate valuation-entry or movement identity within a line is rejected.
- Service and non-stock lines cannot carry Inventory valuation snapshots.
- Commercial and valuation currencies remain independent source facts; Step 3 does not invent FX/accounting conversion policy.
- Supplier and Valuation Company scope must match the Posting Fact Company.
- `purchase-order` facts can be captured without deciding accounting eligibility; event classification remains Step 5.
- Added structured domain error codes and public exports.
- Added focused Step 3 tests, including multi-movement valuation, commercial integrity, duplicate lines, scope mismatch, service/non-stock boundaries and currency independence.
- Added canonical architecture documentation.

### Exit criteria

- [x] Posting Fact is immutable and persistence-neutral.
- [x] Upstream commercial facts are copied as provenance, not re-entered.
- [x] Supplier historical identity is preserved.
- [x] Product/Service historical identity is preserved.
- [x] Purchase document version is captured.
- [x] Company/Branch/Fiscal scope is captured.
- [x] Commercial amount integrity is validated without repricing.
- [x] Document totals reconcile exactly to line snapshots.
- [x] Stock lines support zero-to-many Valuation snapshots.
- [x] One Purchase line may preserve multiple Inventory Movement valuations.
- [x] Service/non-stock lines reject Inventory valuation provenance.
- [x] Cross-company Supplier/Valuation provenance is rejected.
- [x] Durable facts remain free of SQLite row identity.
- [x] Purchase Order eligibility is deferred to Step 5.
- [x] Source Reference contract is deferred to Step 4.
- [x] Posting Rules and Journal generation remain deferred to later steps.

### Validation evidence

- Focused domain tests were added in `packages/purchase-posting/tests/purchase-posting-facts.test.ts`.
- The current repository has no GitHub Actions run for `phase/23-purchase-posting`, so no remote CI PASS is claimed.
- This execution environment cannot reach GitHub from its local shell, therefore a fresh local `pnpm` run could not be executed here.
- The Step 3 code and tests were reviewed against the package's strict TypeScript configuration and existing Phase 20–22 public contracts.
- The repository owner should run the focused package checks locally before accepting the step; commands are listed below.
- Full monorepo validation remains the later formal phase quality gate.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-posting-facts.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-posting-facts.test.ts`
- `docs/architecture/purchase-posting-facts-and-snapshots.md`


## Step 4 — Source Identity and Reference Contracts

### Completed work

- Added immutable `PurchasePostingSourceIdentity` for durable authoritative Purchase source identity.
- Frozen Phase 23 source system to `purchase`; arbitrary source-system values are not accepted by the Purchase Posting bounded context.
- Source identity captures Company, Branch, source type, source ID, aggregate source version and optional independent source revision.
- Added `PurchasePostingSourceLineReference` so accounting provenance can point to an exact durable Purchase line rather than array position/UI row/SQLite identity.
- Added `PurchasePostingTraceContext` with independent `requestId`, `operationId`, `correlationId` and optional `causationId`.
- Root operations may have null causation; self-causation is rejected.
- Added composed `PurchasePostingSourceReference` that combines durable source identity with execution trace context without conflating the two concepts.
- Added Fact-derived factories so Source Identity and Line References are generated directly from the immutable Step 3 Fact without re-entering Company/Branch/Document/Version fields.
- Added exact source-to-Fact validation for Company, Branch, Purchase document type, Purchase document ID and Purchase aggregate version.
- Added exact line-reference validation against the immutable line set captured in Step 3.
- Added deterministic `purchasePostingSourceIdentityKey` for canonical lookup/reference use.
- Canonical key components are URI-escaped to prevent delimiter collisions for durable IDs containing characters such as `:`, `%` or `/`.
- Explicitly documented that the canonical source key is not an idempotency key; posting purpose, payload fingerprint and replay policy remain Step 15.
- Added structured Source Identity/Reference/Trace domain errors and public exports.
- Added focused tests covering source versions/revisions, line references, Fact matching, trace chains, self-causation and canonical-key escaping.
- Added canonical architecture documentation.

### Exit criteria

- [x] Durable source identity is independent of SQLite row IDs.
- [x] Company and Branch are part of source identity.
- [x] Source system/type/ID are explicit.
- [x] Source aggregate version is mandatory.
- [x] Optional independent source revision is explicit.
- [x] Exact Purchase line references are durable.
- [x] Source identity can be derived directly from a Step 3 Fact without duplicate data entry.
- [x] Source identity can be validated against a Step 3 Fact.
- [x] Source line reference can be validated against the captured Fact line set.
- [x] Request and operation identity are distinct from business source identity.
- [x] Correlation and causation semantics are explicit.
- [x] Root causation is supported.
- [x] Self-causation is rejected.
- [x] Canonical source key is deterministic and delimiter-safe.
- [x] Canonical source key is not presented as the final idempotency key.
- [x] Bridge schema/transport concerns remain deferred to Step 22.
- [x] Posting event eligibility remains deferred to Step 5.

### Validation evidence

- Focused Step 4 tests were added in `packages/purchase-posting/tests/purchase-posting-source-reference.test.ts`.
- Repository code review confirms Step 4 contracts are persistence-neutral and only depend on the Purchase Posting domain package.
- The current branch has no GitHub Actions workflow run, therefore no remote CI PASS is claimed.
- A fresh full package/monorepo runtime validation is not claimed in this record; owner acceptance should execute the local commands below.
- Full monorepo validation remains a later formal phase gate.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-posting-source-reference.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-posting-source-reference.test.ts`
- `docs/architecture/purchase-posting-source-identity.md`


## Step 5 — Purchase Posting Event Classification

### Completed work

- Added deterministic event classification based only on immutable `documentType + sourceStatus`.
- Frozen three dispositions: `posting`, `non-posting`, `ineligible`.
- Frozen three accounting event kinds: `supplier-invoice-recognition`, `purchase-return-recognition`, `purchase-correction-recognition`.
- Confirmed Supplier Invoice classifies as an independent posting event.
- Purchase Order classifies as non-posting under the frozen Phase 23 baseline.
- Supplier Invoice terminal `returned` / `corrected` states do not create second accounting events; their confirmed compensating Purchase documents own the new effects.
- Confirmed Purchase Return classifies as an independent compensating posting event.
- Confirmed Purchase Correction classifies as an independent compensating posting event.
- Non-confirmed terminal states on compensating Return/Correction documents classify as ineligible.
- Added reason codes so UI/Application/Audit can explain the classification without inferring meaning from booleans.
- Added `classifyPurchasePostingFact` to classify the immutable Step 3 Fact directly.
- Added `isPurchasePostingEventEligible` as a narrow convenience predicate; it does not replace the richer classification result.
- Explicitly separated event classification from downstream readiness such as Inventory Valuation, account mappings and Fiscal locks.
- Added a complete deterministic test over all 12 combinations of the Step 3 type/status matrix.
- Added canonical architecture documentation.

### Frozen matrix

| Document type | Source status | Disposition | Event kind |
| --- | --- | --- | --- |
| purchase-order | confirmed | non-posting | none |
| purchase-order | returned | non-posting | none |
| purchase-order | corrected | non-posting | none |
| supplier-invoice | confirmed | posting | supplier-invoice-recognition |
| supplier-invoice | returned | non-posting | none |
| supplier-invoice | corrected | non-posting | none |
| purchase-return | confirmed | posting | purchase-return-recognition |
| purchase-return | returned | ineligible | none |
| purchase-return | corrected | ineligible | none |
| purchase-correction | confirmed | posting | purchase-correction-recognition |
| purchase-correction | returned | ineligible | none |
| purchase-correction | corrected | ineligible | none |

### Exit criteria

- [x] Event classification is deterministic and persistence-neutral.
- [x] Purchase Order is explicitly non-posting.
- [x] Confirmed Supplier Invoice is explicitly posting.
- [x] Original Supplier Invoice returned/corrected lifecycle states cannot generate duplicate accounting effects.
- [x] Confirmed Purchase Return is independently posting.
- [x] Confirmed Purchase Correction is independently posting.
- [x] Invalid compensating-document terminal states are explicitly ineligible.
- [x] Classification includes machine-readable reason codes.
- [x] Classification can consume the immutable Step 3 Fact directly.
- [x] Event classification does not resolve accounts.
- [x] Event classification does not calculate debit/credit.
- [x] Event classification does not require Valuation readiness.
- [x] Event classification does not create Journal Vouchers.
- [x] Full Step 3 type/status matrix has focused tests.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-posting-event-classification.test.ts`.
- The test suite covers every combination of the frozen 4 document types and 3 Step 3 source statuses.
- The repository branch currently has no GitHub Actions workflow run; no remote CI PASS is claimed.
- Full package/monorepo runtime validation should be executed locally before owner acceptance.
- Full monorepo validation remains a later formal Phase 23 quality gate.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-posting-event-classification.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-posting-event-classification.test.ts`
- `docs/architecture/purchase-posting-event-classification.md`


## Step 6 — Posting Rules and Account Resolution

### Completed work

- Added role-based Purchase account mapping; no Chart of Accounts ID is hard-coded in posting logic.
- Frozen minimum roles: `inventory-asset`, `purchase-expense`, `accounts-payable`, `input-vat-recoverable`, `purchase-charge`, `grni`.
- Added Purchase Posting Rule scope for Company, optional Branch, optional Event Kind and optional Line Kind.
- Added deterministic rule selection with Branch > Event Kind > Line Kind specificity, then explicit priority.
- Equal-precedence/equal-priority matches fail as ambiguous instead of silently selecting a rule.
- Missing mappings fail explicitly; no fallback suspense/default account is injected.
- Added Account Reader/Resolver contract.
- Resolved accounts must exist, belong to the same Company, be active and have `postingAllowed=true`.
- Kept debit/credit direction, monetary formulas and Journal Line generation out of Step 6.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Account roles are explicit and reusable.
- [x] Account IDs are configuration results, not hard-coded constants.
- [x] Company scope is mandatory.
- [x] Branch/Event/Line scopes are supported.
- [x] Rule selection is deterministic.
- [x] Ambiguous mappings fail explicitly.
- [x] Missing mappings fail explicitly.
- [x] Cross-company/non-active/non-postable accounts are rejected.
- [x] Step 6 does not calculate debit/credit amounts.
- [x] Step 6 does not create Journal Lines.
- [x] Dimensions remain deferred to Step 19.
- [x] Persistence remains deferred to Steps 20–21.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-posting-rules.test.ts`.
- No remote CI PASS is claimed because this branch has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-posting-rules.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-posting-rules.test.ts`
- `docs/architecture/purchase-posting-rules-and-account-resolution.md`


## Step 7 — Supplier Invoice Posting Rules

### Completed work

- Added deterministic Supplier Invoice posting semantics for confirmed Supplier Invoice Facts.
- Supplier payable is credited for the authoritative Purchase `grandTotal`.
- Service and non-stock product principal is debited to `purchase-expense` using Purchase `netAfterDiscount`.
- Stock-product principal is assigned to the `inventory-asset` debit role, but its monetary amount is explicitly deferred to authoritative Inventory Valuation in Step 12.
- Purchase VAT facts are preserved as debit components and explicitly deferred to Step 8.
- Purchase charge facts are preserved as debit components and explicitly deferred to Step 9.
- Added a commercial control check: principal + charges + tax = grand total.
- The step does not create Journal Lines, resolve final VAT/charge policy, or infer stock cost from supplier price.
- GRNI/Inventory timing remains deferred to Step 12.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Confirmed Supplier Invoice is the only accepted source event.
- [x] Supplier payable credit uses Purchase grand total.
- [x] Service/non-stock principal uses Purchase net-after-discount.
- [x] Stock-product amount is not inferred from commercial price.
- [x] Stock-product amount is deferred to authoritative valuation.
- [x] VAT is preserved but deferred to Step 8.
- [x] Charges are preserved but deferred to Step 9.
- [x] Commercial control equation is validated.
- [x] No Journal Voucher/Journal Line is created in Step 7.
- [x] No FIFO/MWA recomputation is introduced.
- [x] GRNI timing remains deferred to Step 12.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/supplier-invoice-posting.test.ts`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/supplier-invoice-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/supplier-invoice-posting.test.ts`
- `docs/architecture/supplier-invoice-posting-rules.md`


## Step 8 — Purchase Tax Posting

### Completed work

- Added Company-scoped Purchase VAT recoverability policy: `recoverable` / `non-recoverable`.
- Recoverable VAT posts as Debit to `input-vat-recoverable`.
- Recoverable VAT remains excluded from Inventory cost and Purchase Expense principal.
- Non-recoverable VAT on stock-product lines is classified as an Inventory capitalizable-cost adjustment and deferred to Step 12.
- Non-recoverable VAT on service/non-stock lines is classified as Purchase Expense debit.
- Tax amounts are consumed from immutable Purchase facts; Step 8 never recomputes tax rates or tax bases.
- The sum of tax posting components must exactly reconcile to document `totals.taxAmount`.
- Zero-tax invoices create no tax posting component.
- Tax policy Company scope must match the Posting Fact Company.
- Supplier payable remains the full Step 7 `grandTotal`; Step 8 only determines the tax debit destination.
- No FIFO/MWA mutation or Journal Line creation is introduced.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Recoverable VAT destination is explicit.
- [x] Recoverable VAT is excluded from normal stock cost/expense principal.
- [x] Non-recoverable stock VAT is deferred as capitalizable cost to Step 12.
- [x] Non-recoverable service/non-stock VAT increases Purchase Expense.
- [x] Tax amount is taken from Purchase facts, not recalculated.
- [x] Tax components reconcile to document tax total.
- [x] Zero tax is handled without synthetic entries.
- [x] Tax policy is Company-scoped.
- [x] Supplier payable remains unchanged.
- [x] FIFO/MWA remains Valuation-owned.
- [x] Journal construction remains Step 13.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-tax-posting.test.ts`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-tax-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-tax-posting.test.ts`
- `docs/architecture/purchase-tax-posting.md`
