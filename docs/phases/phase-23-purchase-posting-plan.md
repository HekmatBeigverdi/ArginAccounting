# Phase 23 — Purchase Posting & Accounting Integration — Fixed Implementation Plan

## Status

Steps 1–25 are complete. Steps 26–30 are not started.

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
- [Purchase Charges Posting](../architecture/purchase-charges-posting.md)
- [Purchase Return Posting](../architecture/purchase-return-posting.md)
- [Purchase Correction Posting](../architecture/purchase-correction-posting.md)
- [Inventory and Valuation Integration](../architecture/purchase-posting-inventory-valuation-integration.md)
- [Draft Journal Generation and Balancing](../architecture/purchase-posting-draft-journal-generation.md)
- [Atomic Journal Posting](../architecture/purchase-posting-atomic-journal-posting.md)
- [Idempotency and Replay Safety](../architecture/purchase-posting-idempotency-and-replay.md)
- [Version and Concurrency Control](../architecture/purchase-posting-version-and-concurrency.md)
- [Controlled Posting Reversal](../architecture/purchase-posting-controlled-reversal.md)
- [Fiscal Scope and Period Locks](../architecture/purchase-posting-fiscal-scope-and-locks.md)
- [Branch and Accounting Dimensions](../architecture/purchase-posting-branch-and-dimensions.md)
- [Purchase Posting SQLite Persistence](../architecture/purchase-posting-sqlite-persistence.md)
- [Purchase Posting SQLite Repository, Readers and Unit of Work](../architecture/purchase-posting-sqlite-repository-uow.md)
- [Purchase Posting Argin Bridge Contract](../architecture/purchase-posting-argin-bridge-contract.md)
- [Purchase Posting Permissions, Audit and Traceability](../security/purchase-posting-security-audit-traceability.md)
- [Purchase-to-Ledger Reconciliation](../architecture/purchase-posting-reconciliation.md)
- [Purchase Posting UI and Trace Viewer](../architecture/purchase-posting-ui-and-trace-viewer.md)

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
| 9 | Purchase Charges Posting | Completed |
| 10 | Purchase Return Posting | Completed |
| 11 | Purchase Correction Posting | Completed |
| 12 | Inventory and Valuation Integration | Completed |
| 13 | Draft Journal Generation and Balancing | Completed |
| 14 | Atomic Journal Posting | Completed |
| 15 | Idempotency and Replay Safety | Completed |
| 16 | Version and Concurrency Control | Completed |
| 17 | Controlled Posting Reversal | Completed |
| 18 | Fiscal Scope and Period Locks | Completed |
| 19 | Branch and Accounting Dimensions | Completed |
| 20 | Persistence and SQLite Migration | Completed |
| 21 | Repository, Reader and Unit of Work | Completed |
| 22 | Argin Bridge Posting Contracts | Completed |
| 23 | Permissions, Audit and Traceability | Completed |
| 24 | Purchase-to-Ledger Reconciliation | Completed |
| 25 | Posting UI and Trace Viewer | Completed |
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


## Step 9 — Purchase Charges Posting

### Completed work

- Added Purchase charge posting semantics for confirmed Supplier Invoice Facts.
- Preserved the Phase 22 cost boundary where stock-line `chargeAmount` is already included in `taxBaseAmount` and therefore in the authoritative Purchase Cost Input.
- Stock charges are classified as Inventory capitalizable cost and explicitly deferred to Step 12 instead of being debited a second time.
- Service/non-stock charges are classified as debit to the `purchase-charge` account role.
- Charge amounts are consumed from immutable Purchase facts; Step 9 does not recalculate or invent charge values.
- The sum of charge components must exactly reconcile to `fact.totals.chargeAmount`.
- Zero-charge invoices create no synthetic charge posting component.
- External landed-cost facts are not invented or merged into Purchase commercial facts.
- No FIFO/MWA mutation or Journal Line construction is introduced.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Stock Purchase charges are not double-counted.
- [x] Stock charge remains inside authoritative Purchase Cost Input.
- [x] Stock charge accounting destination is Inventory Asset through Step 12 valuation integration.
- [x] Service/non-stock charge destination is Purchase Charge Expense.
- [x] Charge amount comes from immutable Purchase facts.
- [x] Charge components reconcile exactly to document charge total.
- [x] Zero charge creates no synthetic component.
- [x] External landed cost is not invented.
- [x] FIFO/MWA remains Valuation-owned.
- [x] Journal construction remains Step 13.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-charge-posting.test.ts`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-charge-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-charge-posting.test.ts`
- `docs/architecture/purchase-charges-posting.md`


## Step 10 — Purchase Return Posting

### Completed work

- Added confirmed Purchase Return posting semantics as a new compensating accounting event.
- Supplier payable is debited for the Purchase Return `grandTotal`.
- Stock Inventory is credited only from authoritative outbound Inventory Valuation; supplier price is never used as stock-return value.
- Stock return valuation is explicitly deferred to Step 12.
- Recoverable Input VAT is credited on return.
- Non-recoverable stock VAT remains inside the capitalized Inventory amount and is reversed through outbound valuation rather than credited twice.
- Non-recoverable service/non-stock VAT reverses Purchase Expense.
- Service/non-stock principal credits Purchase Expense.
- Service/non-stock Purchase charges credit the `purchase-charge` account role.
- Added durable original Supplier Invoice reference to the return posting plan; self-reference is rejected.
- Original Supplier Invoice/Cost Input is never rewritten.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Purchase Return is represented as an independent compensating posting event.
- [x] Accounts Payable is debited by return grand total.
- [x] Stock Inventory credit uses outbound FIFO/MWA valuation only.
- [x] Original inbound Cost Input is not rewritten.
- [x] Recoverable VAT reverses Input VAT.
- [x] Non-recoverable stock VAT is not double-counted.
- [x] Service/non-stock expense and charges are reversed.
- [x] Original Supplier Invoice linkage is explicit.
- [x] Self-reference is rejected.
- [x] Journal construction remains deferred to Step 13.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-return-posting.test.ts`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-return-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-return-posting.test.ts`
- `docs/architecture/purchase-return-posting.md`


## Step 11 — Purchase Correction Posting

### Completed work

- Added confirmed Purchase Correction posting semantics based on immutable original-vs-corrected Fact comparison.
- Correction deltas are derived deterministically; users/UI do not re-enter posting deltas.
- Supported correction effects are `commercial-replacement`, `quantity-decrease`, and `quantity-increase`.
- Supplier payable delta is derived from corrected `grandTotal - original grandTotal`; positive deltas credit AP and negative deltas debit AP.
- Service/non-stock principal, charge and tax deltas are posted directly to their Step 7–9 roles.
- Recoverable VAT delta uses `input-vat-recoverable`.
- Non-recoverable service/non-stock VAT delta uses `purchase-expense`.
- Stock cost/quantity corrections produce `inventory-valuation-delta` components deferred to Step 12; Purchase price is not used as authoritative Inventory correction value.
- Explicit durable original Supplier Invoice and original/correction line links are required.
- Same Company, Branch, Supplier, Currency, Product/Service identity and line kind are enforced.
- Duplicate line links and self/mismatched source references are rejected.
- Original Purchase/Inventory/Journal facts remain immutable.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Correction posting is a new accounting delta, not mutation.
- [x] Deltas are derived from authoritative original/corrected facts.
- [x] Supplier payable direction follows grand-total delta.
- [x] Service/non-stock commercial deltas post directly.
- [x] Recoverable VAT delta is explicit.
- [x] Stock corrections remain valuation-owned.
- [x] Quantity increase/decrease is deferred to Step 12 valuation integration.
- [x] Original Supplier Invoice linkage is explicit.
- [x] Line mappings are durable and unique.
- [x] Cross-scope/product/type mismatches are rejected.
- [x] Journal construction remains Step 13.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-correction-posting.test.ts`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-correction-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-correction-posting.test.ts`
- `docs/architecture/purchase-correction-posting.md`


## Step 12 — Inventory and Valuation Integration

### Completed work

- Added the authoritative monetary bridge from Phase 21 Inventory Valuation to Phase 23 Purchase Posting.
- Supplier Invoice stock components resolve from the sum of linked authoritative inbound valuation entries.
- Purchase Return stock components resolve from authoritative outbound valuation; signed negative valuation becomes a positive Inventory credit amount.
- Purchase Correction commercial replacement resolves as corrected valuation minus original valuation.
- Purchase Correction quantity increase consumes authoritative inbound follow-up valuation.
- Purchase Correction quantity decrease consumes authoritative outbound compensating valuation.
- FIFO and Moving Weighted Average are never recalculated inside Purchase Posting.
- Missing valuation, Company/Product/Currency mismatch and invalid inbound/outbound sign direction fail explicitly.
- Multiple valuation movements for one Purchase line aggregate deterministically.
- Resolved posting retains valuation provenance: valuation entry IDs, movement IDs, policy IDs, methods, strategy versions, currency and signed total cost.
- Deferred Step 12 components are converted to concrete amounts and no longer carry `deferredToStep=12`.
- Added focused tests and architecture documentation.

### Exit criteria

- [x] Stock Supplier Invoice amount comes only from authoritative valuation.
- [x] Stock Purchase Return amount comes only from outbound FIFO/MWA valuation.
- [x] Commercial correction uses valuation delta rather than Purchase-price delta.
- [x] Quantity increase/decrease consumes follow-up/compensating valuation output.
- [x] FIFO/MWA algorithms are not duplicated.
- [x] Signed valuation direction is validated.
- [x] Missing valuation fails explicitly.
- [x] Company/Product/Currency mismatches fail explicitly.
- [x] Multi-movement valuation aggregation is deterministic.
- [x] Valuation provenance is retained for audit/replay/Bridge.
- [x] Journal construction remains Step 13.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/inventory-valuation-integration.test.ts`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/inventory-valuation-integration.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/inventory-valuation-integration.test.ts`
- `docs/architecture/purchase-posting-inventory-valuation-integration.md`


## Step 13 — Draft Journal Generation and Balancing

### Completed work

- Added the boundary that converts fully resolved Purchase Posting components into the canonical `@argin/accounting/journal` `JournalVoucher`.
- Supplier Invoice draft composition now combines Step 7 principal/payable semantics with Step 8 tax, Step 9 charges and Step 12 stock valuation.
- Raw deferred tax/charge placeholders from Step 7 are never emitted as Journal Lines.
- Stock Purchase charges already included in authoritative Cost Input/Valuation are not posted twice.
- Purchase Return and Purchase Correction resolved components can be converted through the same draft-journal boundary.
- Every effective component resolves its Account through the Step 6 Posting Rule engine.
- No account ID is hard-coded in draft generation.
- Remaining `amount=null` or `deferredToStep` components fail before Accounting.
- All component currencies must match the Purchase Fact currency.
- Purchase Posting validates exact debit/credit equality before calling Accounting.
- No suspense account or synthetic balancing line is allowed.
- Accounting `createJournalVoucher` then applies its own canonical draft/balance/line invariants as a second validation boundary.
- Journal source provenance carries Purchase document ID plus request/correlation/causation trace.
- Caller supplies durable Journal Voucher/Line IDs and Number; Step 13 generates no random identity.
- Accounting dimensions remain empty and are deferred to Step 19.
- Added focused tests and architecture documentation.
- Added explicit `@argin/accounting` workspace dependency and synchronized the lockfile importer.

### Exit criteria

- [x] Fully resolved Purchase Posting can produce the canonical Accounting draft voucher.
- [x] Unresolved/deferred components are rejected.
- [x] Account resolution uses Step 6 rules.
- [x] No hard-coded Account IDs are introduced.
- [x] Supplier Invoice stock charges are not double-posted.
- [x] Debit and Credit totals must match before Accounting creation.
- [x] No automatic balancing/suspense entry exists.
- [x] Accounting performs a second balance/invariant validation.
- [x] Source-document trace is preserved.
- [x] Durable Journal Voucher/Line identities are caller supplied.
- [x] Journal status is Draft only.
- [x] No persistence or posting commit occurs in Step 13.
- [x] Dimensions remain deferred to Step 19.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/draft-journal-generation.test.ts`.
- The package now declares `@argin/accounting` as a workspace dependency and the lockfile importer is updated.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package typecheck/test should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/draft-journal-generation.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/package.json`
- `packages/purchase-posting/tests/draft-journal-generation.test.ts`
- `pnpm-lock.yaml`
- `docs/architecture/purchase-posting-draft-journal-generation.md`


## Step 14 — Atomic Journal Posting

### Completed work

- Added the application transaction boundary that commits the Accounting Draft Journal and Purchase Posting linkage as one indivisible operation.
- Clarified lifecycle semantics: Step 14 does not bypass Accounting approval/final posting; the Journal remains `draft`.
- Added `preparePurchasePosting` domain transition from `draft` to `prepared`.
- A prepared Purchase Posting now requires a durable `journalVoucherId`.
- The prepare transition enforces optimistic `expectedVersion`, canonical timestamp order and version increment.
- Added persistence-neutral `PurchasePostingAtomicUnitOfWork` and transaction-bound session contracts.
- Atomic session exposes only the two writes required here: `createJournalDraft` and `savePreparedPosting`.
- Pre-transaction validation enforces Draft Journal status, Company/Branch scope, source-document provenance and double-entry balance.
- Journal write failure prevents Purchase Posting persistence.
- Purchase Posting write failure rolls back the staged Journal write.
- No inner-write failure may be swallowed and followed by a partial commit.
- Concrete SQLite transaction/repository implementation remains intentionally deferred to Steps 20–21.
- Added focused rollback/atomicity tests and architecture documentation.

### Exit criteria

- [x] Accounting Journal draft and Purchase Posting link share one Unit of Work.
- [x] Purchase Posting moves from Draft to Prepared only with a durable Journal ID.
- [x] Prepared/Posted/Reversed aggregate states require Journal linkage.
- [x] Journal remains Draft; Accounting lifecycle is not bypassed.
- [x] Cross-Company/Branch Journal linkage fails before persistence.
- [x] Unbalanced/non-source-document Journal fails before persistence.
- [x] Optimistic Posting version is checked.
- [x] Journal write failure produces no partial Posting commit.
- [x] Posting write failure produces no orphan Journal commit.
- [x] Storage contract is persistence-neutral and Bridge-compatible.
- [x] SQLite adapter work remains Steps 20–21.
- [x] Idempotency/replay remains Step 15.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/atomic-journal-posting.test.ts`.
- Tests use a transaction-like staged Unit of Work to prove commit-on-success and rollback-on-failure semantics.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local package/accounting typecheck and Purchase Posting tests should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/application/atomic-journal-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/atomic-journal-posting.test.ts`
- `docs/architecture/purchase-posting-atomic-journal-posting.md`


## Step 15 — Idempotency and Replay Safety

### Completed work

- Added final Purchase Posting idempotency identity based on durable source identity + source version/revision + posting purpose.
- Frozen posting purpose is `accounting-recognition`.
- Added lowercase SHA-256 payload fingerprint contract (64 hexadecimal characters).
- Request/transport IDs are explicitly not used as financial idempotency identity.
- Added deterministic idempotency-key generation over the canonical Step 4 source identity.
- Added immutable idempotency records containing source, purpose, payload fingerprint, Posting ID, Journal ID, committed Posting version and committed timestamp.
- Exact replay returns the original prepared Posting and Journal with `replayed=true` and performs no duplicate Journal write.
- Same source/version/revision/purpose with a different payload fingerprint fails with `idempotency_conflict`.
- New source version/revision naturally creates a distinct posting identity.
- First execution atomically writes Journal Draft + prepared Purchase Posting + Idempotency Record in one Unit of Work.
- Replay lookup occurs inside the Unit of Work to avoid a check-then-write application gap.
- Replay validates the stored outcome rather than trusting an orphaned idempotency row.
- Missing/mismatched prepared Posting or Journal fails with `replay_outcome_invalid`.
- SQLite unique constraints/persistence remain deferred to Steps 20–21.
- Added focused first-run/replay/conflict/new-version tests and architecture documentation.

### Exit criteria

- [x] Durable source/version/revision participates in idempotency identity.
- [x] Posting purpose participates in idempotency identity.
- [x] Deterministic payload fingerprint is required.
- [x] Exact replay returns the original committed outcome.
- [x] Exact replay performs no duplicate Journal write.
- [x] Same identity with a different payload conflicts.
- [x] New source version/revision is a distinct posting attempt.
- [x] Request ID is not treated as financial idempotency identity.
- [x] Journal + Posting + Idempotency Record commit in one Unit of Work.
- [x] Replay verifies durable stored outcome integrity.
- [x] SQLite row identity is excluded from replay identity.
- [x] Database unique constraints remain Steps 20–21.
- [x] General concurrency policy remains Step 16.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/replay-safe-posting.test.ts`.
- Tests cover first execution, exact replay, fingerprint conflict and distinct source-version behavior.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local Accounting/Purchase Posting typecheck and Purchase Posting tests should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-posting-idempotency.ts`
- `packages/purchase-posting/src/application/replay-safe-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/replay-safe-posting.test.ts`
- `docs/architecture/purchase-posting-idempotency-and-replay.md`


## Step 16 — Version and Concurrency Control

### Completed work

- Added explicit optimistic-concurrency guards for Purchase Posting mutations.
- Caller snapshots are no longer trusted as final write authority.
- Both atomic and replay-safe mutation paths now load the current Purchase Posting inside the same Unit of Work before transition.
- Current Posting version must exactly match `expectedPostingVersion`; stale callers fail with `concurrency_conflict`.
- Current Posting must still be Draft with no Journal link; otherwise the mutation fails with `concurrency_state_mismatch`.
- Company, Branch and Posting ID scope are revalidated against the currently loaded aggregate.
- New Purchase-generated Journal Drafts must start at `version=1` and `status=draft`.
- Reused/already-mutated Journal objects fail with `journal_version_conflict`.
- Exact idempotent replay remains intentionally checked before current-version validation, so a valid retry still returns the original committed outcome after aggregate advancement.
- CAS persistence remains required: concrete adapters must save with `expectedVersion` and treat zero affected rows as concurrency conflict.
- Added focused stale-version/state/journal-version tests and extended replay/atomic-path coverage.

### Exit criteria

- [x] Current aggregate is loaded inside the transaction before mutation.
- [x] Expected version is compared to current version.
- [x] Stale version fails explicitly.
- [x] Stale lifecycle state fails explicitly.
- [x] Scope is revalidated against the current aggregate.
- [x] Caller snapshot cannot silently overwrite newer state.
- [x] New Journal Draft must be version 1.
- [x] Exact replay is evaluated before current-version validation.
- [x] Atomic and replay-safe paths share the concurrency policy.
- [x] CAS repository semantics are documented for Steps 20–21.
- [x] SQLite row identity is not concurrency identity.
- [x] Reversal-specific concurrency remains Step 17.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/posting-concurrency.test.ts`.
- Existing atomic and replay-safe tests were updated to load current Posting state inside the transaction.
- Replay coverage now includes a stale caller version that still succeeds as an exact replay.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local Accounting/Purchase Posting typecheck and Purchase Posting tests should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/posting-concurrency.ts`
- `packages/purchase-posting/src/application/atomic-journal-posting.ts`
- `packages/purchase-posting/src/application/replay-safe-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/posting-concurrency.test.ts`
- `packages/purchase-posting/tests/atomic-journal-posting.test.ts`
- `packages/purchase-posting/tests/replay-safe-posting.test.ts`
- `docs/architecture/purchase-posting-version-and-concurrency.md`


## Step 17 — Controlled Posting Reversal

### Completed work

- Added a controlled Purchase Posting reversal flow that reuses the canonical Accounting Journal reversal contract instead of duplicating reversal logic.
- Posted Purchase/Journal history remains immutable; reversal is represented by a new posted Reversal Journal plus a Purchase Posting `posted → reversed` transition.
- Added `reversePurchasePosting` domain transition with expected-version, linked-original-Journal and timestamp validation.
- The original `journalVoucherId` remains on the aggregate as the Journal that originally recognized the Purchase; the reversal Journal ID is stored in a separate immutable reversal record.
- Added `PurchasePostingReversalRecord` with Posting ID, original Journal ID, reversal Journal ID, request ID, actor, time, reason and committed Posting version.
- Reversal requires the current Purchase Posting to be posted, Company-owned, version-current and linked to the Journal being reversed.
- Accounting Journal reversal outcome is validated: original Journal must be reversed, reversal Journal must be posted, and lineage IDs must match the Purchase Posting link.
- Purchase Posting and Journal each retain their own optimistic concurrency versions.
- Exact reversal replay by request ID returns the existing outcome and does not save the Purchase Posting again.
- Reusing a reversal request ID for a different Posting fails with `reversal_conflict`.
- The Unit of Work contract requires coordinated Journal reversal + Purchase Posting state transition + reversal lineage persistence.
- Concrete SQLite transaction coordination remains deferred to Steps 20–21.
- Added focused reversal/state/replay/concurrency tests and architecture documentation.

### Exit criteria

- [x] Original posted Journal is never edited to erase history.
- [x] Reversal creates a distinct Accounting Reversal Journal.
- [x] Purchase Posting transitions from Posted to Reversed.
- [x] Original Journal link remains stable on the aggregate.
- [x] Reversal Journal link is stored separately as lineage.
- [x] Accounting-owned reversal validation is reused.
- [x] Purchase and Journal optimistic versions are both required.
- [x] Journal reversal outcome is checked against the linked Purchase Posting Journal.
- [x] Exact reversal replay is supported.
- [x] Request-ID reuse across different Postings conflicts.
- [x] Reversal coordination is expressed as one Unit-of-Work boundary.
- [x] SQLite persistence remains Steps 20–21.
- [x] Fiscal lock policy remains Step 18.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/controlled-posting-reversal.test.ts`.
- Tests cover first reversal, original/reversal lineage, exact replay, request conflict, stale Posting version and non-posted state rejection.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local Accounting/Purchase Posting typecheck and Purchase Posting tests should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/application/controlled-posting-reversal.ts`
- `packages/purchase-posting/src/domain/purchase-posting.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/controlled-posting-reversal.test.ts`
- `docs/architecture/purchase-posting-controlled-reversal.md`


## Step 18 — Fiscal Scope and Period Locks

### Completed work

- Added a Purchase Posting fiscal gate using the same Fiscal Year / Fiscal Period semantics already used by Accounting.
- New posting requires Company, Fiscal Year ID, Fiscal Period ID and operation date to match the resolved fiscal context.
- Fiscal Year must be `open`; `draft`, `closing` and `closed` are rejected.
- Fiscal Period must be `open`; both `locked` and `closed` are rejected.
- Operation date must fall inside both the Fiscal Year and Fiscal Period date ranges.
- Added Historical Lock enforcement for `all`, `accounting` and `purchases` scopes.
- A Historical Lock blocks the operation when `operationDate <= lockedThroughDate`.
- Atomic Posting and Replay-safe Posting now run the fiscal gate inside the same Unit of Work before first-execution persistence.
- Exact idempotent replay is intentionally evaluated before the first-execution fiscal gate so a historical committed retry remains deterministic after later period closure.
- Controlled Reversal validates the fiscal context of `reversalDate`, allowing reversal into a later valid open period without mutating the original period.
- Reversal destination Fiscal Year/Period are resolved from the reversal date; new postings additionally require exact Journal Fiscal IDs.
- Added explicit fiscal/lock error codes and focused tests for open/locked/closed/mismatch/date-range/Historical-Lock behavior.

### Exit criteria

- [x] Fiscal context must exist.
- [x] Company scope must match.
- [x] New posting Fiscal Year ID must match the resolved context.
- [x] New posting Fiscal Period ID must match the resolved context.
- [x] Fiscal Year must be open.
- [x] Fiscal Period must be open.
- [x] Posting date must be inside Fiscal Year and Period ranges.
- [x] Historical `all` lock blocks posting.
- [x] Historical `accounting` lock blocks posting.
- [x] Historical `purchases` lock blocks posting.
- [x] Reversal validates the destination reversal date context.
- [x] Exact replay remains deterministic after later lock/closure.
- [x] Fiscal gate is wired into atomic, replay-safe and reversal flows.
- [x] SQLite adapter work remains Steps 20–21.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/fiscal-scope-and-locks.test.ts`.
- Existing atomic/replay/reversal test sessions were updated with an open fiscal context and Historical Lock reader.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local Accounting/Purchase Posting typecheck and Purchase Posting tests should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/fiscal-scope-and-locks.ts`
- `packages/purchase-posting/src/application/atomic-journal-posting.ts`
- `packages/purchase-posting/src/application/replay-safe-posting.ts`
- `packages/purchase-posting/src/application/controlled-posting-reversal.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/fiscal-scope-and-locks.test.ts`
- `packages/purchase-posting/tests/atomic-journal-posting.test.ts`
- `packages/purchase-posting/tests/replay-safe-posting.test.ts`
- `packages/purchase-posting/tests/controlled-posting-reversal.test.ts`
- `docs/architecture/purchase-posting-fiscal-scope-and-locks.md`


## Step 19 — Branch and Accounting Dimensions

### Completed work

- Preserved Purchase `branchId` as the canonical Journal Voucher Branch scope; no duplicate automatic Branch dimension was introduced.
- Added semantic Purchase dimension sources for Party, Product, Warehouse, Cost Center and Project.
- Business IDs are never written directly as Accounting Dimension Member IDs.
- Added `PurchasePostingDimensionReader` resolver boundary from business references to existing Accounting Dimension Members.
- Supplier/Party is available for both document-level and line-level posting components.
- Product comes from the Purchase line item.
- Warehouse comes only from authoritative valuation snapshots and is never invented for service/non-stock lines.
- Cost Center and Project are accepted as optional posting context because the current Purchase Fact does not own those facts.
- Account Dimension Policies drive assignment: Required/Optional may assign; Forbidden/unconfigured dimensions are not auto-injected.
- Required dimensions that cannot resolve a valid Member fail before Journal creation.
- Final assignments are validated by Accounting's existing `validateAccountingDimensionAssignments`.
- Accounting-owned validation remains authoritative for type/member status, Company scope, validity dates, duplicates and multiple-member allowance.
- Dimension assignments are normalized deterministically by Dimension Type and Member ID.
- Draft Journal generation now resolves dimensions after Account resolution and writes them to canonical Journal Lines.
- Added focused dimension-reference/policy/required/forbidden tests and a Branch scope assertion.

### Exit criteria

- [x] Branch remains a first-class Journal Voucher scope.
- [x] Supplier can resolve to Party dimension.
- [x] Product can resolve from a Purchase line.
- [x] Warehouse can resolve from authoritative valuation facts.
- [x] Cost Center and Project can be supplied through explicit posting context.
- [x] Operational IDs are not directly treated as Accounting Member IDs.
- [x] Account Dimension Policy controls whether dimensions are allowed/required.
- [x] Forbidden/unconfigured dimensions are not automatically injected.
- [x] Missing required dimension fails explicitly.
- [x] Existing Accounting dimension validation is reused.
- [x] Final assignments are deterministic.
- [x] Draft Journal Lines carry resolved dimension assignments.
- [x] Dimension master-data ownership remains Accounting/Phase 11.

### Validation evidence

- Focused tests were added in `packages/purchase-posting/tests/purchase-posting-dimensions.test.ts`.
- Draft Journal tests now provide the Dimension Reader contract and verify the generated Journal retains `branchId`.
- No remote CI PASS is claimed because the branch currently has no GitHub Actions run.
- Local Accounting/Purchase Posting typecheck and Purchase Posting tests should be executed before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```

### Files introduced or changed

- `packages/purchase-posting/src/domain/purchase-posting-dimensions.ts`
- `packages/purchase-posting/src/domain/draft-journal-generation.ts`
- `packages/purchase-posting/src/domain/purchase-posting-domain-errors.ts`
- `packages/purchase-posting/src/index.ts`
- `packages/purchase-posting/tests/purchase-posting-dimensions.test.ts`
- `packages/purchase-posting/tests/draft-journal-generation.test.ts`
- `docs/architecture/purchase-posting-branch-and-dimensions.md`


## Step 20 — Persistence and SQLite Migration

### Completed work

- Added Desktop SQLite migration `0033_purchase_posting.sql` and registered it as migration version 33.
- Added durable `purchase_postings` aggregate persistence with Company/Branch scope, lifecycle status, original Journal linkage, optimistic version and Bridge sync metadata.
- Added unique Journal-to-Purchase-Posting linkage so one Accounting Journal cannot be owned by multiple Purchase Postings.
- Added `purchase_posting_rules` persistence for the minimum Purchase-specific account-resolution rules from Step 6.
- Added durable priority/active/version and Bridge metadata for Posting Rules.
- Added append-only `purchase_posting_idempotency` with canonical source identity/version/revision/purpose, SHA-256 fingerprint and committed Posting/Journal outcome.
- Added unique source-identity + purpose replay boundary, including deterministic NULL-revision normalization.
- Added append-only `purchase_posting_reversals` with original/reversal Journal lineage and Company-scoped request uniqueness.
- Added UPDATE/DELETE blocking triggers for idempotency and reversal evidence.
- Added indexes for posting status, Journal lookup, rule resolution, source replay, reversal trace and incremental Bridge scans.
- Added real SQLite migration execution coverage against a minimal prerequisite schema.
- Updated the canonical Database Dictionary and architecture documentation.
- Concrete repositories, readers and Unit of Work remain Step 21.

### Exit criteria

- [x] Migration 33 is registered in Desktop.
- [x] Purchase Posting aggregate has durable SQLite persistence.
- [x] Posting Rules have durable SQLite persistence.
- [x] Idempotency outcome is durable and append-only.
- [x] Reversal lineage is durable and append-only.
- [x] Journal linkage is relational and Company-consistent.
- [x] Version columns support later CAS repositories.
- [x] Durable identity does not depend on SQLite row IDs.
- [x] Bridge sync metadata exists on mutable Posting/Rule state.
- [x] Source replay has a unique durable identity boundary.
- [x] Reversal request identity is Company-unique.
- [x] Query/replay/Bridge indexes are present.
- [x] Migration contract includes real SQLite execution.
- [x] Repository/UoW implementation remains Step 21.

### Validation evidence

- Added `apps/desktop/tests/purchase-posting-migration.test.ts`.
- The test suite verifies registration, tables, append-only triggers, indexes/fingerprint constraints and real SQLite execution.
- No local or CI PASS is claimed from this session; run the commands below before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/desktop test
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
```


## Step 21 — Repository, Reader and Unit of Work

### Completed work

- Added workspace adapter package `@argin/purchase-posting-tauri`.
- Added `SqlitePurchasePostingRepository` with durable rehydration, insert and compare-and-swap update.
- CAS uses Posting ID + Company + expected version; zero affected rows become `concurrency_conflict`.
- Added `SqlitePurchasePostingRuleRepository` with deterministic active-rule reads and optimistic rule updates.
- Added `SqlitePurchasePostingIdempotencyRepository` for exact replay evidence.
- Added `SqlitePurchasePostingReversalRepository` for controlled reversal lineage.
- Added minimal Account reader for Step 6 account resolution.
- Added Fiscal context/Historical Lock reader for Step 18.
- Added Accounting Dimension reader for Step 19.
- Dimension business-source mapping is configurable by Dimension Type ID rather than relying on hidden hard-coded Dimension codes.
- Added generic `SqlitePurchasePostingUnitOfWork` exposing all repositories/readers and the canonical Accounting Journal repository over one transaction-bound `DatabaseSession`.
- Added Step 14 Atomic UoW adapter and Step 15 Replay-safe UoW adapter.
- Added Step 17 Reversal UoW adapter with exact active-session handoff to a canonical Accounting Journal reverser, avoiding nested transactions.
- Added focused repository/CAS/same-session/reversal-session tests.
- Added workspace lockfile importer for the new adapter package.

### Exit criteria

- [x] Aggregate repository can rehydrate durable Purchase Posting state.
- [x] Aggregate update uses expected-version CAS.
- [x] Posting Rules are readable/persistable.
- [x] Idempotency records are readable/appendable.
- [x] Reversal lineage is readable/appendable.
- [x] Account reader satisfies Step 6 resolution needs.
- [x] Fiscal/Historical Lock reader satisfies Step 18.
- [x] Dimension reader satisfies Step 19 without hard-coded Dimension conventions.
- [x] Generic UoW binds all adapters to one transaction session.
- [x] Atomic Posting uses one SQLite transaction.
- [x] Replay-safe Posting uses one SQLite transaction.
- [x] Reversal can invoke Accounting through the exact same transaction session.
- [x] No SQLite row ID leaks into Domain/Application identity.
- [x] Workspace lockfile includes the new adapter package.

### Validation evidence

- Added `packages/purchase-posting-tauri/tests/sqlite-purchase-posting.test.ts`.
- Tests cover rehydration, CAS SQL/conflict, transaction-session affinity, replay access and reversal-session handoff.
- No local/CI PASS is claimed from this session; run the commands below before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
pnpm --filter @argin/purchase-posting-tauri typecheck
pnpm --filter @argin/purchase-posting-tauri test
```


## Step 22 — Argin Bridge Posting Contracts

### Completed work

- Added versioned wire-neutral Purchase Posting synchronization contract with `contractVersion=1` and `schemaVersion=1`.
- Added authoritative envelope families for Purchase Posting state, Purchase Posting Rules and immutable Purchase Posting Reversal lineage.
- Posting envelopes preserve durable Company/Branch/Posting IDs and the complete Step 4 Purchase source identity including source type, ID, version and nullable revision.
- Posting purpose and the exact Step 15 idempotency key are preserved; Bridge does not invent a second financial idempotency identity.
- Added mandatory request/operation/correlation/causation trace metadata using the existing Purchase Posting trace rules.
- Added canonical SHA-256 payload fingerprint requirement.
- Added `occurredAt`, `effectiveAt` and `changedAt` UTC metadata with ordering validation.
- Added origin source-system/source-instance and nullable server-revision metadata.
- Journal Vouchers remain Accounting-owned; Bridge envelopes reference Journal IDs only through durable dependencies rather than duplicating Journal payloads.
- Posting Rule envelopes carry local version/timestamps and Account/optional Branch dependencies.
- Reversal envelopes are immutable revision-1 evidence with original/reversal Journal dependencies.
- No tombstone envelope is defined for financial Posting/Reversal history.
- Frozen conflict semantics prohibit timestamp-based last-write-wins over financial history and prevent serverRevision from replacing local optimistic versions.
- No transport, outbox, remote apply, PostgreSQL or .NET implementation was introduced.
- No additional SQLite migration is required because Steps 20–21 already reserved the required durable sync metadata.

### Exit criteria

- [x] Contract version is explicit.
- [x] Schema version is explicit.
- [x] Posting source type/ID/version/revision are durable wire facts.
- [x] Company/Branch/Posting IDs are durable wire identities.
- [x] Request/operation/correlation/causation metadata are explicit.
- [x] Payload fingerprint is canonical SHA-256.
- [x] occurredAt/effectiveAt/changedAt are explicit canonical timestamps.
- [x] Step 15 idempotency key is reused rather than reinvented.
- [x] Journal payload ownership remains Accounting.
- [x] Journal/Purchase/Account/Branch dependencies are explicit.
- [x] Posting Rule synchronization is versioned.
- [x] Reversal lineage is immutable revision 1.
- [x] Financial history has no tombstone contract.
- [x] Transport/infrastructure remains out of scope.
- [x] SQLite row identity is absent from the wire contract.

### Validation evidence

- Added `packages/purchase-posting/tests/purchase-posting-sync-contract.test.ts`.
- Tests cover Posting, Rule and Reversal envelopes, version metadata, dependencies, source revisions, fingerprint validation and trace self-causation rejection.
- No local/CI PASS is claimed from this session; run the commands below before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
pnpm --filter @argin/purchase-posting-tauri typecheck
pnpm --filter @argin/purchase-posting-tauri test
```


## Step 23 — Permissions, Audit and Traceability

### Completed work

- Added independent Purchase Posting permissions for view, execute, controlled reversal, Posting Rule management and trace viewing.
- Registered all five permissions in the shared Security default-permission catalog under module `purchases`.
- Added persistence-neutral Purchase Posting authorization, Audit and trace contracts.
- Added `SecuredPurchasePostingService` as the Application security boundary.
- Posting/Reversal/View/Trace authorization reloads the persisted Purchase Posting and uses its actual Company/Branch scope.
- Caller-provided scope cannot override persisted Posting scope.
- Posting execution requires `purchases.posting.execute`; Reversal requires `purchases.posting.reverse`.
- Posting Rule mutation requires `purchases.posting.rules.manage`.
- Trace view requires `purchases.posting.trace.view`; ordinary Posting view has its own `purchases.posting.view` permission.
- Posting trace must match the Accounting Draft Journal source request/correlation/causation metadata before the operation is authorized.
- Reversal request ID must match the secured trace request ID.
- Added append-only shared-Audit event contract containing actor, Company/Branch, Posting/Journal/Reversal IDs, source identity, request/operation/correlation/causation, before/after status/version and durable operation metadata.
- Added deterministic Audit identity helper `purchase-posting:{action}:{operationId}:{targetId}`.
- Explicit replay/reversal-replay Audit actions preserve operational trace without duplicating accounting side effects.
- Preserved Accounting permission ownership: Purchase Posting execute does not grant Journal approval/final-post rights.
- Added `PurchasePostingTraceReader` contract and trace snapshot shape for Step 24 reconciliation / Step 25 Trace Viewer without prematurely implementing those later steps.
- Added focused security/audit tests and Security catalog coverage.

### Exit criteria

- [x] Purchase Posting permissions are independently assignable.
- [x] Permissions are registered in the shared Security catalog.
- [x] Application boundary enforces permission before mutation.
- [x] Authorization uses persisted Company/Branch scope.
- [x] Caller scope cannot override persisted Posting scope.
- [x] Posting and Reversal have separate permissions.
- [x] Posting Rule management has a separate permission.
- [x] Posting view and Trace view have separate permissions.
- [x] Accounting Journal approval/final-post permission ownership remains Accounting.
- [x] Posting trace must match Journal source trace.
- [x] Reversal trace request identity is checked.
- [x] Successful operations emit shared Audit events.
- [x] Audit event carries durable source/Posting/Journal/Reversal identities.
- [x] Audit identity is deterministic across retries.
- [x] Replay is auditable without duplicate accounting writes.
- [x] No new Audit or Approval store is introduced.
- [x] Trace Reader contract is frozen for Steps 24–25.

### Validation evidence

- Added `packages/purchase-posting/tests/purchase-posting-security.test.ts`.
- Added `packages/security/tests/purchase-posting-permissions.test.ts`.
- Focused coverage verifies persisted scope authorization, trace mismatch rejection, deterministic Audit identity and permission catalog registration.
- No local/CI PASS is claimed from this session; run the commands below before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/security typecheck
pnpm --filter @argin/security test
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
pnpm --filter @argin/purchase-posting-tauri typecheck
pnpm --filter @argin/purchase-posting-tauri test
```


## Step 24 — Purchase-to-Ledger Reconciliation

### Completed work

- Added persistence-neutral Purchase-to-Ledger reconciliation contracts and deterministic issue vocabulary.
- Added forward lookup from durable Purchase source type/ID to all matching Purchase Posting outcomes by source version/revision.
- Added reverse lookup from Purchase Posting ID, Accounting Journal Voucher ID and Journal Line ID back to the durable Purchase source.
- Reversal Journal IDs are also reverse-resolvable through immutable reversal lineage.
- Reconciliation snapshots include Purchase source identity, Purchase Posting, full canonical Accounting Journal/Lines, optional Reversal lineage/Journal, issues and a final reconciled flag.
- Missing Posting or Journal links are surfaced as explicit diagnostic issues instead of being silently discarded.
- Added Company, Branch and Journal source-link integrity checks.
- Added Journal balance verification without recomputing commercial or inventory valuation facts.
- Added lifecycle alignment checks: Prepared↔Draft Journal, Posted↔Posted Journal and Reversed↔Reversed original Journal + Posted reversal Journal.
- Added Reversal lineage/original/reversal Journal integrity checks.
- Added concrete `SqlitePurchasePostingReconciliationReader`.
- Exposed the reconciliation reader through `@argin/purchase-posting-tauri` and the shared SQLite Purchase Posting UoW context.
- No new projection table or migration was introduced; reconciliation is rebuilt directly from authoritative persistence.

### Exit criteria

- [x] Purchase Source -> Posting -> Journal -> Lines forward trace exists.
- [x] Posting -> Purchase Source reverse trace exists.
- [x] Journal Voucher -> Purchase Source reverse trace exists.
- [x] Journal Line -> Purchase Source reverse trace exists.
- [x] Reversal Journal -> original Purchase Posting trace exists.
- [x] Missing Posting/Journal links are explicit issues.
- [x] Company and Branch integrity are checked.
- [x] Journal source identity is checked.
- [x] Journal balance is checked.
- [x] Posting/Journal lifecycle alignment is checked.
- [x] Reversed Posting requires reversal lineage.
- [x] Reversal Journal identity/status/balance are checked.
- [x] No commercial pricing or FIFO/MWA recomputation is introduced.
- [x] Reconciliation remains read-only/rebuildable.
- [x] SQLite reader uses authoritative existing tables.
- [x] No synchronization authority is transferred to reconciliation.

### Validation evidence

- Added `packages/purchase-posting/tests/purchase-posting-reconciliation.test.ts`.
- Added `packages/purchase-posting-tauri/tests/sqlite-purchase-posting-reconciliation.test.ts`.
- Tests cover evaluator integrity plus source, Journal Line and Reversal Journal reverse lookup contracts.
- No local/CI PASS is claimed from this session; run the commands below before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
pnpm --filter @argin/purchase-posting-tauri typecheck
pnpm --filter @argin/purchase-posting-tauri test
```


## Step 25 — Posting UI and Trace Viewer

### Completed work

- Added a Purchase Posting panel directly into the existing Purchase Documents workspace.
- The panel is sourced only from Step 24 reconciliation data; no duplicate UI projection table was introduced.
- Added Desktop composition service `createPurchasePostingWorkspaceServices` backed by `SqlitePurchasePostingReconciliationReader`.
- Added independent permission checks for Posting view, Trace view, execute eligibility and controlled reversal eligibility.
- Branch access is filtered against the signed-in actor's allowed Branch IDs.
- The panel displays Posting status, Accounting Journal number/status, balanced Journal amount and reconciliation health.
- Multiple source versions/revisions can be selected when more than one Posting outcome exists.
- Added expandable source → Posting → Journal → optional Reversal Journal trace.
- Added canonical Accounting Journal Line display with Account ID, Debit and Credit.
- Added Persian reconciliation diagnostics for all Step 24 issue codes.
- Added explicit no-Posting states for Purchase Order, non-confirmed documents and permission-limited confirmed documents.
- No Purchase price, discount, charge, tax, FIFO/MWA or Account-selection inputs were introduced in the Posting UI.
- React does not build Journal Lines or recalculate commercial/valuation facts.
- Desktop dependencies now include `@argin/purchase-posting` and `@argin/purchase-posting-tauri`.
- Added responsive panel styling and Desktop contract tests.
- Posting mutation remains behind the secured Application boundary; the UI does not create a parallel posting engine from raw form values.

### Exit criteria

- [x] Purchase workspace exposes Posting status without duplicate data entry.
- [x] Purchase Source ID/type drive the Posting lookup.
- [x] Posting status and Journal lifecycle are visible.
- [x] Journal balance amount is visible.
- [x] Reconciliation health/issues are visible.
- [x] Source → Posting → Journal trace is visible.
- [x] Reversal Journal lineage is visible when present.
- [x] Canonical Journal Lines are visible.
- [x] Multiple source versions/revisions are distinguishable.
- [x] Purchase Order non-posting state is explained.
- [x] Non-confirmed Posting ineligibility is explained.
- [x] Posting view and Trace permissions remain independent.
- [x] Branch scope is enforced before read exposure.
- [x] No UI-owned pricing/tax/valuation recalculation is introduced.
- [x] No duplicate commercial/account-entry form is introduced.
- [x] No new SQLite projection/migration is required.

### Validation evidence

- Added `apps/desktop/tests/purchase-posting-ui.test.ts`.
- Contract tests verify panel embedding, selected Purchase source binding, trace/reconciliation UI, Journal Line rendering, permission separation and absence of commercial re-entry fields.
- No local/CI PASS is claimed from this session; run the commands below before owner acceptance.

### Local verification commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @argin/purchase-posting typecheck
pnpm --filter @argin/purchase-posting test
pnpm --filter @argin/purchase-posting-tauri typecheck
pnpm --filter @argin/purchase-posting-tauri test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop build
```
