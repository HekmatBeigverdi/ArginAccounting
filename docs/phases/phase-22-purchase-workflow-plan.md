# Phase 22 — Purchase Workflow — Fixed Implementation Plan

## Status

Steps 1–15 are complete on `phase/22-purchase-workflow`. The fixed 24-step sequence remains frozen. Step 16 — SQLite Repository and Unit of Work — is next.

## Governance

The 24 step titles, order, scope and ownership boundaries are frozen unless an explicitly approved Change Request is recorded here. Owner acceptance and executable validation evidence remain separate.

Mandatory references:
- [Documentation Governance](../development/documentation-governance.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Roadmap](../../ROADMAP.md)
- [Phase 20 — Inventory Documents](phase-20-inventory-documents-plan.md)
- [Phase 21 — Inventory Valuation](phase-21-inventory-valuation-plan.md)
- [Purchase Domain Model](../architecture/purchase-domain-model.md)
- [Purchase Commercial Semantics](../architecture/purchase-commercial-semantics.md)
- [Purchase Document Types and Lifecycle](../architecture/purchase-lifecycle.md)
- [Purchase Company, Branch, Fiscal Scope and Numbering](../architecture/purchase-scope-and-numbering.md)
- [Purchase Pricing and Totals Engine](../architecture/purchase-pricing-and-totals.md)
- [Purchase Receipt and Invoice Matching Policy](../architecture/purchase-receipt-invoice-matching.md)
- [Purchase Inventory Receipt Integration](../architecture/purchase-inventory-receipt-integration.md)
- [Purchase Inventory Valuation Cost Input Integration](../architecture/purchase-inventory-valuation-cost-input.md)
- [Purchase Receipt-Before-Invoice and Cost Resolution Policy](../architecture/purchase-receipt-before-invoice-policy.md)
- [Purchase Return and Correction Workflow](../architecture/purchase-return-correction-workflow.md)
- [Purchase Application, Query and Repository Contracts](../architecture/purchase-application-query-repository-contracts.md)
- [Purchase SQLite Schema](../architecture/purchase-sqlite-schema.md)
- [Purchase Application Services and Transaction Boundaries](../architecture/purchase-application-services-and-transaction-boundaries.md)

## Baseline and Release Target

- Baseline: `phase/21-inventory-valuation` at `a3ca48df64c64ffd81b1ddf107c082b7ce371e89`.
- Branch: `phase/22-purchase-workflow`.
- Target: `0.22.0` / `v0.22.0`.
- Phase 22 must not be released ahead of required Phase 21 promotion/reconciliation.

## Core Invariants

- Purchase owns supplier commercial price; Phase 21 owns FIFO/MWA valuation.
- Phase 20 remains authoritative for quantity movements; Phase 23 owns accounting posting.
- Services/non-stock purchases do not create Inventory Cost Inputs solely because they are purchased.
- Historical Purchase supplier/item snapshots are immutable facts.
- Durable IDs are independent of SQLite row identity and Bridge-ready.
- Purchase quantity uses canonical decimal strings, not binary floating point.
- Purchase money uses safe integers in the currency's smallest unit plus explicit ISO currency.
- Percentage discounts, charges and tax rates use integer basis points.
- Monetary rounding is explicit and deterministic.
- Approval and confirmation are distinct lifecycle gates; only confirmed Purchase facts may become operational inputs to later Inventory/Valuation integration.
- Confirmed Purchase history is never silently rewritten; return/correction requires linked compensating document identity.
- Every Purchase aggregate is bound to a durable Company/Branch/Fiscal scope whose Company matches the aggregate Company.
- Purchase captures fiscal context for history, while `@argin/fiscal` remains authoritative for current period/lock policy and Number Series reservation.
- Pricing is deterministic: gross, ordered discounts, net after discount, ordered charges, tax base, tax and grand total are derived with safe-integer money, basis points and `half-away-from-zero` rounding.
- Receipt/invoice matching is line-level, uses durable match IDs and base quantities, and cannot over-allocate either an invoice line or a confirmed Inventory receipt line.
- Purchase stages Inventory-owned receipt drafts from confirmed stock intent; Purchase never creates StockMovement facts directly or bypasses Inventory lifecycle/approval/confirmation.
- Normal confirmed Purchase cost is supplied automatically to Inventory Valuation through durable movement/match/source identity; partially matched or missing commercial cost remains explicitly unresolved and is never silently zero.
- Receipt-before-invoice uses defer-until-authoritative-cost: physical receipt confirmation is not blocked, valuation remains unresolved, and later authoritative cost requires deterministic recalculation from the affected movement.
- Returns and corrections are immutable compensating Purchase documents. They never rewrite confirmed supplier invoices, confirmed Inventory movements or historical authoritative Cost Inputs in place.
- Application contracts are persistence-neutral and expose durable Purchase document, commercial fact, match, cost-input, request and operation identities without SQLite row IDs.
- Purchase persistence is additive and durable-ID based: lifecycle/match facts are append-only, document numbering is Fiscal/Branch scoped, and Bridge-ready synchronization metadata is stored without making SQLite row identity authoritative.
- Application Services re-check current Fiscal eligibility before Purchase mutations, keep Purchase writes inside `PurchaseUnitOfWork`, and invoke Inventory/Valuation only through explicit ports without direct cross-context persistence.
- Valuation recalculation caused by a newly committed Purchase-backed Cost Input occurs only after the Purchase UoW has committed that Cost Input.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Purchase Domain Model | Completed |
| 3 | Supplier, Product, Service and Commercial Snapshots | Completed |
| 4 | Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics | Completed |
| 5 | Purchase Document Types and Lifecycle | Completed |
| 6 | Company, Branch, Fiscal Scope and Numbering | Completed |
| 7 | Purchase Pricing and Totals Engine | Completed |
| 8 | Receipt and Invoice Matching Policy | Completed |
| 9 | Inventory Receipt Integration | Completed |
| 10 | Inventory Valuation Cost Input Integration | Completed |
| 11 | Receipt-Before-Invoice and Cost Resolution Policy | Completed |
| 12 | Purchase Return and Correction Workflow | Completed |
| 13 | Application, Query and Repository Contracts | Completed |
| 14 | Application Services and Transaction Boundaries | Completed |
| 15 | Migration, Schema, Constraints and Indexing | Completed |
| 16 | SQLite Repository and Unit of Work | Not started |
| 17 | Idempotency, Optimistic Concurrency and Replay Safety | Not started |
| 18 | Argin Bridge Purchase Synchronization Contract | Not started |
| 19 | Permissions, Approval, Audit and Traceability | Not started |
| 20 | Persian RTL Purchase Workspace | Not started |
| 21 | Purchase Queries and Operational Reports | Not started |
| 22 | Domain and Application Tests | Not started |
| 23 | SQLite, Migration, Inventory, Valuation, Bridge and Desktop Integration Tests | Not started |
| 24 | Monorepo Validation, Documentation, Final Review and Release | Not started |

## Fixed Execution Sequence

1. Baseline, Branch, Scope and Plan Freeze
2. Purchase Domain Model
3. Supplier, Product, Service and Commercial Snapshots
4. Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics
5. Purchase Document Types and Lifecycle
6. Company, Branch, Fiscal Scope and Numbering
7. Purchase Pricing and Totals Engine
8. Receipt and Invoice Matching Policy
9. Inventory Receipt Integration
10. Inventory Valuation Cost Input Integration
11. Receipt-Before-Invoice and Cost Resolution Policy
12. Purchase Return and Correction Workflow
13. Application, Query and Repository Contracts
14. Application Services and Transaction Boundaries
15. Migration, Schema, Constraints and Indexing
16. SQLite Repository and Unit of Work
17. Idempotency, Optimistic Concurrency and Replay Safety
18. Argin Bridge Purchase Synchronization Contract
19. Permissions, Approval, Audit and Traceability
20. Persian RTL Purchase Workspace
21. Purchase Queries and Operational Reports
22. Domain and Application Tests
23. SQLite, Migration, Inventory, Valuation, Bridge and Desktop Integration Tests
24. Monorepo Validation, Documentation, Final Review and Release

## Step 4 — Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics

### Exit Criteria and Evidence

- Canonical positive decimal quantity strings with exact entered-to-base conversion.
- Entered/base unit snapshots include ratio, precision, rounding mode and Taxpayer unit code.
- Money is non-negative safe integer + normalized three-letter currency.
- Fixed adjustments must match unit-price currency; percentage adjustments use 0–10,000 basis points.
- Tax treatment/rate combinations are validated explicitly.
- Monetary rounding contract is `half-away-from-zero`.
- Step 4 does not calculate final line/header totals, implement lifecycle, create Inventory/Valuation side effects or post accounting entries.
- Added `purchase-commercial-semantics.ts`, public exports, Step 4 error codes and `purchase-commercial-semantics.test.ts`.
- TDD RED was observed before implementation because the Step 4 module did not yet exist.
- Fresh isolated Node 22 execution after implementation: 4 tests passed, 0 failed.
- Full monorepo validation remains Step 24; no unobserved CI success is claimed.

## Step 5 — Purchase Document Types and Lifecycle

### Exit Criteria and Evidence

- Frozen document types: `purchase-order`, `supplier-invoice`, `purchase-return`, `purchase-correction`.
- Frozen statuses: `draft`, `submitted`, `approved`, `confirmed`, `cancelled`, `returned`, `corrected`.
- Transition matrix separates Approval from Confirmation and prevents post-confirmation cancellation/edit-style rollback.
- `returned` and `corrected` require a reason plus a distinct linked compensating document ID; self-linking is rejected.
- Approved-to-draft reopening requires an explicit reason.
- Lifecycle history is chronological, immutable and records actor, timestamps, reason and related document identity.
- Purchase aggregate carries document type/status/history/version/timestamps.
- Lifecycle transitions increment aggregate version without assuming `version === history.length + 1`.
- Added `purchase-lifecycle.ts`, lifecycle domain errors, aggregate lifecycle actions, public exports and `purchase-lifecycle.test.ts`.
- Fresh isolated Node 22 lifecycle smoke verification after implementation: 2 tests passed, 0 failed.

## Step 6 — Company, Branch, Fiscal Scope and Numbering

### Exit Criteria and Evidence

- Added immutable `PurchaseDocumentScope` with durable Company, Branch, fiscal-year and fiscal-period IDs plus captured date boundaries/status/lock context.
- Purchase business date must fall inside both the captured fiscal year and fiscal period.
- New Purchase facts require captured fiscal year and period to be open; dates on or before captured `lockedThroughDate` are rejected.
- Aggregate `companyId` must match `scope.companyId`.
- `PurchaseDocumentSnapshot` carries frozen scope and nullable `documentNumber`.
- Number allocation remains owned by `@argin/fiscal`; Purchase only produces the compatible number-series request.
- Fresh isolated Node 22 verification: 4 tests passed, 0 failed.

## Step 7 — Purchase Pricing and Totals Engine

### Exit Criteria and Evidence

- Deterministic sequence: gross, ordered discounts, net after discount, ordered charges, tax base, tax and grand total.
- Binary floating point is not used for monetary calculation.
- Percentage adjustments use `half-away-from-zero` rounding.
- Tax uses the post-discount/post-charge tax base.
- Document aggregation rejects mixed currencies.
- Added `purchase-pricing.ts`, public exports and tests.
- Fresh isolated Node 22 verification: 4 tests passed, 0 failed.

## Step 8 — Receipt and Invoice Matching Policy

### Exit Criteria and Evidence

- Matching is line-level between confirmed supplier-invoice and confirmed Inventory receipt lines.
- Matching uses canonical base quantities and durable match IDs.
- Company/Product identity must agree and cumulative allocations cannot exceed either side.
- Status is derived as `unmatched`, `partially-matched` or `fully-matched`.
- Added matching domain module, errors, public exports and tests.
- Fresh isolated Node 22 verification: 5 tests passed, 0 failed; strict TypeScript exit code 0.

## Step 9 — Inventory Receipt Integration

### Exit Criteria and Evidence

- Confirmed Purchase stock intent stages Inventory-owned receipt drafts only; Purchase never creates stock movements directly.
- Staged lines preserve durable source line, Product, base quantity and Warehouse intent.
- Service/non-stock lines, unconfirmed documents, duplicate allocations and over-quantity are rejected.
- Request carries durable source identity, request key and payload fingerprint.
- Commercial facts are resolved from Purchase state rather than re-entered by the operator.
- Added integration module, errors, public exports, tests and architecture documentation.
- Fresh isolated Node 22 verification: 6 tests passed, 0 failed.

## Step 10 — Inventory Valuation Cost Input Integration

### Exit Criteria and Evidence

- Purchase-backed Cost Input preserves durable movement/receipt/match/Purchase source provenance.
- Only confirmed supplier-invoice stock-product facts resolve normal Purchase cost.
- Valuation base uses `taxBaseAmount` and excludes VAT from normal inventory cost.
- Multi-receipt allocation is deterministic and exact after remainder allocation.
- Incomplete/missing cost remains unresolved; zero cost is never silently substituted.
- Provider boundary is structurally compatible with Phase 21 valuation.
- Fresh focused Node 22 verifier: 5 tests passed, 0 failed; strict TypeScript exit code 0.

## Step 11 — Receipt-Before-Invoice and Cost Resolution Policy

### Exit Criteria and Evidence

- Confirmed physical receipt may precede supplier invoice.
- Missing Purchase cost does not block Inventory confirmation but valuation remains unresolved.
- No automatic provisional/estimated or silent zero cost is permitted.
- Unresolved reasons: `awaiting-supplier-invoice`, `partial-invoice-match`, `supplier-invoice-cost-unavailable`.
- Full later coverage resolves through Step 10 and requires `cost_basis_changed` recalculation.
- Added policy module, public exports, tests and architecture documentation.
- Full package verification remains deferred to formal validation gates.

## Step 12 — Purchase Return and Correction Workflow

### Exit Criteria and Evidence

- Confirmed purchase-return and purchase-correction documents are durable compensating facts linked to a confirmed supplier invoice.
- Purchase returns create outbound Inventory intent and cannot exceed original line quantity.
- Partial returns remain independent linked documents.
- Corrections support commercial replacement, quantity decrease and quantity increase effects.
- Quantity deltas create compensating Inventory intent instead of editing old movements.
- Historical Purchase-cost changes declare `cost_basis_changed` replay from affected movements.
- Added workflow module, errors, public exports, tests and architecture documentation.
- TDD RED preceded implementation; full package verification remains deferred to formal validation gates.

## Step 13 — Application, Query and Repository Contracts

### Exit Criteria and Evidence

- Added durable `PurchaseOperationContext` carrying Company, Branch, request ID, operation ID, actor ID and normalized UTC timestamp.
- Added command contracts for Purchase creation/lifecycle, Inventory receipt staging, receipt/invoice matching and movement-cost resolution without implementing orchestration.
- Added read-only Query service contracts and normalized document-list filtering with bounded pagination.
- Added `PurchaseDocumentRepository`, `PurchaseCommercialFactRepository`, `PurchaseReceiptInvoiceMatchRepository`, and `PurchaseValuationCostInputRepository`.
- Commercial facts remain a separate authoritative repository keyed by durable Purchase document/line IDs; downstream modules must not create a second operator-entry path.
- Added persistence-neutral `PurchaseUnitOfWork` exposing the four repositories inside one transaction context; concrete SQLite commit/rollback remains Step 16.
- Added narrow Fiscal ports for current-period eligibility and authoritative Purchase number reservation; the historical scope snapshot cannot bypass current Fiscal locks.
- `requestId` and `operationId` are carried now, while final idempotency/replay semantics remain Step 17.
- Added public exports and `purchase-application-contracts.test.ts`.
- Added architecture documentation in `purchase-application-query-repository-contracts.md`.
- TDD RED was established by committing the Step 13 contract test before the new application-contract modules existed.
- Fresh focused Node 22 verification of runtime contract normalization: 3 tests passed, 0 failed.
- Fresh strict TypeScript verification of the Step 13 contract modules completed with exit code 0.
- Full package/monorepo validation remains owned by Steps 22–24 and is not claimed here.

## Step 14 — Application Services and Transaction Boundaries

### Exit Criteria and Evidence

- Added `createPurchaseApplicationServices` exposing concrete command and query services over the Step 13 contracts.
- Purchase creation re-checks current Fiscal eligibility, reserves an authoritative Purchase number when needed, creates the Domain aggregate, and persists the aggregate plus Purchase-owned commercial facts inside one Purchase UoW.
- Submit, approve, confirm, cancel and reopen load the aggregate inside the UoW, enforce Company/Branch scope, validate `expectedVersion`, re-check current Fiscal eligibility, invoke the existing Domain transition and persist with the original expected version.
- Explicit terminal `returnPurchase`/`correct` transitions require an already confirmed compensating Purchase document of the expected type that points back to the original. Confirming a partial return alone does not automatically mark the original fully returned.
- Inventory receipt staging resolves Purchase-owned commercial facts in a completed Purchase read transaction and only then invokes the Inventory-owned staging port; Purchase never writes Inventory movements.
- Receipt/invoice matching resolves the authoritative confirmed Inventory receipt line through a reader port, combines existing invoice/receipt allocations, re-runs the Step 8 Domain matcher, and only persists the validated match.
- Movement-cost resolution reads the authoritative Inventory movement, resolves Purchase matches/commercial facts, evaluates the Step 11 policy, persists newly resolved/replaced Cost Input inside the Purchase UoW, and invokes valuation recalculation only after that UoW commits.
- Query services implement document lookup/listing and read-only receipt-cost decision inspection using Step 13 normalization.
- Added explicit application errors and narrow external ports for Inventory movement reading, confirmed receipt-line reading and valuation recalculation without transferring authority into Purchase.
- Added public exports and `purchase-application-service.test.ts` covering create ordering, lifecycle Fiscal/version enforcement and Inventory staging side-effect ordering.
- Added architecture documentation in `purchase-application-services-and-transaction-boundaries.md`.
- TDD RED was established by committing the Step 14 application-service test before the service module existed.
- Direct full-package execution from this session was attempted after implementation, but the execution container could not resolve `github.com`; therefore no fresh full-package pass is claimed here. Formal package/monorepo validation remains Steps 22–24.


## Step 15 — Migration, Schema, Constraints and Indexing

### Exit Criteria and Evidence

- Added and registered Desktop migration `0030_purchase_workflow.sql` as migration version 30 after Phase 21 migrations 28/29.
- Added durable Purchase tables for documents, lines, lifecycle, commercial facts, receipt/invoice matches, Purchase valuation Cost Inputs and idempotency storage.
- Purchase document storage preserves Company/Branch/Fiscal/Supplier scope, immutable Supplier snapshot JSON, source/correction references, optimistic version and Bridge-ready synchronization metadata.
- Purchase lines preserve durable item identity and immutable item snapshot JSON while commercial pricing remains normalized in `purchase_commercial_facts`; downstream Inventory/Valuation flows must not create duplicate operator-entered commercial values.
- Commercial monetary values are constrained to non-negative JavaScript-safe integers; percentage tax rate storage is bounded to basis-point range and currency is normalized to uppercase three-letter form.
- Lifecycle and receipt/invoice match facts are append-only at SQLite boundary through UPDATE/DELETE rejection triggers.
- Document numbers are unique within Company + Fiscal Year + Branch + Purchase document type; duplicate invoice-line/receipt-line match pairs are rejected; one current Purchase Cost Input exists per Inventory movement.
- `purchase_idempotency` reserves durable Company/request and Company/operation uniqueness plus payload fingerprint/outcome storage for Step 17 without defining replay semantics early.
- Indexes cover Step 13 list/query paths, Supplier/Branch/Fiscal filters, match lookups from both sides, Cost Input movement lookup and future Bridge incremental-change scans.
- Migration is additive and performs no destructive transformation of existing Inventory/Valuation data; concrete SQLite repositories and pinned transaction UoW remain Step 16.
- Updated the canonical Database Dictionary and added architecture documentation in `purchase-sqlite-schema.md`.
- TDD RED was observed before implementation: the focused migration-contract suite failed 5/5 because migration version 30 and `0030_purchase_workflow.sql` did not yet exist.
- Fresh focused migration-contract verification after implementation: 5 tests passed, 0 failed.
- Fresh SQLite execution of the final Step 15 schema passed with dependency-compatible tables and exercised document-number uniqueness, append-only lifecycle, duplicate match rejection, Cost Input movement uniqueness and operation-ID uniqueness.
- Full empty-database/upgrade/restart/rollback/Desktop integration validation remains owned by Steps 23–24 and is not claimed here.

## Change Requests

None.
