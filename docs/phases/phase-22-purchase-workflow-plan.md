# Phase 22 — Purchase Workflow — Fixed Implementation Plan

## Status

Steps 1–12 are complete on `phase/22-purchase-workflow`. The fixed 24-step sequence remains frozen. Step 13 — Application, Query and Repository Contracts — is next.

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
- Pricing is deterministic: gross, ordered discounts, ordered charges, tax base, tax and grand total are derived with safe-integer money, basis points and `half-away-from-zero` rounding.
- Receipt/invoice matching is line-level, uses durable match IDs and base quantities, and cannot over-allocate either an invoice line or a confirmed Inventory receipt line.
- Purchase stages Inventory-owned receipt drafts from confirmed stock intent; Purchase never creates StockMovement facts directly or bypasses Inventory lifecycle/approval/confirmation.
- Normal confirmed Purchase cost is supplied automatically to Inventory Valuation through durable movement/match/source identity; partially matched or missing commercial cost remains explicitly unresolved and is never silently zero.
- Receipt-before-invoice uses defer-until-authoritative-cost: physical receipt confirmation is not blocked, valuation remains unresolved, and later authoritative cost requires deterministic recalculation from the affected movement.
- Returns and corrections are immutable compensating Purchase documents. They never rewrite confirmed supplier invoices, confirmed Inventory movements or historical authoritative Cost Inputs in place.

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
| 13 | Application, Query and Repository Contracts | Not started |
| 14 | Application Services and Transaction Boundaries | Not started |
| 15 | Migration, Schema, Constraints and Indexing | Not started |
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

## Step 4 Exit Criteria and Evidence

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

## Step 5 Exit Criteria and Evidence

- Frozen document types: `purchase-order`, `supplier-invoice`, `purchase-return`, `purchase-correction`.
- Frozen statuses: `draft`, `submitted`, `approved`, `confirmed`, `cancelled`, `returned`, `corrected`.
- Transition matrix separates Approval from Confirmation and prevents post-confirmation cancellation/edit-style rollback.
- `returned` and `corrected` require a reason plus a distinct linked compensating document ID; self-linking is rejected.
- Approved-to-draft reopening requires an explicit reason.
- Lifecycle history is chronological, immutable and records actor, timestamps, reason and related document identity.
- Purchase aggregate now carries `documentType`, `status`, `lifecycleHistory`, shared aggregate `version`, `createdAt` and `updatedAt`.
- Lifecycle transitions increment aggregate version without assuming `version === history.length + 1`, preserving compatibility with future draft edits and Step 17 optimistic concurrency.
- Added `purchase-lifecycle.ts`, lifecycle domain errors, aggregate lifecycle actions, public exports and `purchase-lifecycle.test.ts`.
- Existing Purchase aggregate tests were updated to use explicit document type and validate initial `draft` lifecycle state.
- Fresh isolated Node 22 lifecycle smoke verification after implementation: 2 tests passed, 0 failed, covering confirmed-to-returned flow and self-linked correction rejection.
- GitHub has no workflow run registered for the verified commit; full workspace/monorepo validation remains owned by later validation gates.

## Step 6 Exit Criteria and Evidence

- Added immutable `PurchaseDocumentScope` with durable Company, Branch, fiscal-year and fiscal-period IDs plus captured date boundaries/status/lock context.
- Purchase business date must fall inside both the captured fiscal year and fiscal period.
- New Purchase facts require captured fiscal year and period to be open; dates on or before captured `lockedThroughDate` are rejected.
- Aggregate `companyId` must match `scope.companyId`; rehydration executes the same scope and date validation.
- `PurchaseDocumentSnapshot` now carries its frozen scope and nullable `documentNumber`.
- Number allocation is not duplicated in Purchase: `createPurchaseNumberSeriesRequest` produces the existing `@argin/fiscal.generateDocumentNumber` contract using `companyId`, `branchId`, `fiscalYearId` and `entityType = purchase:<documentType>`.
- `@argin/fiscal` remains authoritative for current fiscal policy, historical-lock checks, sequence applicability/reservation and number formatting. Step 14 will re-check current Fiscal state and orchestrate number reservation inside the appropriate transaction boundary.
- The captured scope is historical/Bridge evidence and must not be used to bypass a newer locally closed or locked period.
- Added `purchase-scope.ts`, Step 6 domain error codes, public exports and `purchase-scope-numbering.test.ts`; existing aggregate tests were updated with scope fixtures and mismatch/lock coverage.
- TDD RED was reproduced before implementation with Node 22 as `ERR_MODULE_NOT_FOUND` for the not-yet-created Step 6 module.
- Fresh isolated Node 22 verification on the final Step 6 scope/numbering source: 4 tests passed, 0 failed.
- Full package/monorepo validation is not claimed from the isolated verifier; broader validation remains owned by Steps 22–24.

## Step 7 Exit Criteria and Evidence

- Added deterministic line pricing sequence: gross amount, ordered discounts, net after discount, ordered charges, tax base, tax amount and grand total.
- Quantity × unit-price multiplication uses integer/BigInt decimal arithmetic; binary floating point is not used for monetary calculation.
- Each percentage adjustment is evaluated against the current amount in stored order and rounded with `half-away-from-zero`; fixed adjustments remain explicit money.
- A discount that would make a line negative is rejected with `purchase.pricing_invalid`.
- Tax is calculated from the post-discount/post-charge tax base only for `taxable` terms; exempt/not-subject/unspecified yield zero tax.
- Document totals aggregate line totals only when all lines share the same currency; mixed-currency aggregation is rejected.
- Added `purchase-pricing.ts`, public exports, pricing error code and `purchase-pricing-totals.test.ts`.
- Added architecture documentation in `purchase-pricing-and-totals.md` and preserved Step 8+ scope boundaries.
- Fresh isolated Node 22 verification of pricing behavior: 4 tests passed, 0 failed, covering deterministic line totals, sequential percentage discounts, over-discount rejection and same-currency document aggregation.
- Full package/monorepo validation remains owned by Steps 22–24 and is not claimed here.

## Step 8 Exit Criteria and Evidence

- Added line-level matching between confirmed `supplier-invoice` lines and confirmed Inventory `receipt` lines only.
- Matching uses canonical positive base-quantity strings so invoice and receipt entered units may differ without changing the matching result.
- Every match is an immutable durable fact with its own `matchId`, Company ID, invoice document/line IDs, receipt document/line IDs, Product ID and matched base quantity.
- Company and Product identity must agree across both sides.
- Duplicate `matchId` values and duplicate invoice-line/receipt-line pairs are rejected.
- Cumulative matches cannot exceed either the invoice-line base quantity or the receipt-line base quantity, including allocation of one receipt line across different invoice lines.
- Invoice-line status is derived as `unmatched`, `partially-matched` or `fully-matched`; matching status is not stored as an authoritative mutable field.
- Added `purchase-receipt-invoice-matching.ts`, Step 8 domain error codes, public exports and `purchase-receipt-invoice-matching.test.ts`.
- Added architecture documentation in `purchase-receipt-invoice-matching.md`; Step 9 remains responsible for actual Inventory receipt integration and Step 10/11 for valuation/cost-resolution behavior.
- TDD RED was reproduced before implementation with Node 22 as `ERR_MODULE_NOT_FOUND` for the not-yet-created Step 8 module.
- Fresh isolated Node 22 verification of the final Step 8 matching source: 5 tests passed, 0 failed.
- Fresh strict TypeScript check of the Step 8 source completed with exit code 0.
- Full package/monorepo validation remains owned by Steps 22–24 and is not claimed here.

## Step 9 Exit Criteria and Evidence

- Added Purchase-to-Inventory receipt staging for confirmed `purchase-order` and `supplier-invoice` stock intent only.
- Purchase does not create stock movements; `stagePurchaseInventoryReceipt` invokes only an InventorySourceDocumentPort-compatible `stageDraft` boundary and returns the Inventory-owned draft result.
- Every staged line preserves durable Purchase `sourceLineId`, Product identity, canonical decimal quantity and Warehouse intent.
- Staged quantity is expressed in the Purchase commercial fact's captured base unit, preventing entered-unit ambiguity between Purchase and Inventory.
- Service/non-stock lines, unconfirmed documents, unsupported Purchase document types, duplicate source-line allocations and quantities above the captured Purchase base quantity are rejected.
- Request carries `sourceSystem = purchase`, Purchase document type/ID, durable Inventory document ID, request key and payload fingerprint; final replay/idempotency behavior remains Step 17.
- Step 9 uses a structurally Inventory-compatible port/request contract without adding a Purchase runtime dependency on Inventory; formal Application adapter wiring remains Steps 13–14.
- The current aggregate does not yet persist `PurchaseCommercialTerms` directly on `PurchaseDocumentLineSnapshot`; Step 9 therefore consumes immutable Purchase-owned commercial facts keyed by durable line ID. Steps 13–16 must resolve these facts from Purchase state and must not create a second operator entry path.
- Added `purchase-inventory-receipt-integration.ts`, Step 9 domain error codes, public exports and `purchase-inventory-receipt-integration.test.ts`.
- Restored missing public exports for Step 4 commercial semantics used by the integration contract.
- Added architecture documentation in `purchase-inventory-receipt-integration.md` and preserved Step 10+ boundaries.
- TDD RED was observed before implementation as `ERR_MODULE_NOT_FOUND` for the not-yet-created Step 9 module.
- Fresh isolated Node 22 verification of Step 9 integration behavior: 6 tests passed, 0 failed.
- Full package/monorepo validation remains owned by Steps 22–24 and is not claimed here.

## Step 10 Exit Criteria and Evidence

- Added linked Purchase Cost Input snapshots that preserve durable Cost Input, Inventory movement, receipt document/line, Product, Company, match and Purchase document/line identity.
- Only confirmed `supplier-invoice` `stock-product` commercial facts can resolve normal Purchase cost; mismatched Company/Product/source identity and mixed currencies are rejected.
- The valuation base uses Step 7 `taxBaseAmount` (`net after discount + line charges`) and excludes VAT/tax from the normal inventory cost base.
- A Purchase line distributed across multiple receipt matches allocates cost by canonical base quantity using deterministic cumulative rounding; full allocation sums exactly to the Purchase line tax base.
- Cost resolution is movement-level: a fully matched partial receipt can resolve even when the supplier invoice has quantity remaining for later receipts.
- A movement with no match, incomplete match coverage or missing commercial fact remains `null`/unresolved; zero cost is never silently substituted.
- The derived basis is structurally compatible with `InventoryResolvedInboundCostBasis`; `createPurchaseInventoryValuationCostInputProvider` exposes it through an `InventoryValuationCostInputProvider`-compatible boundary without adding a runtime Purchase dependency on Inventory.
- Added `purchase-inventory-valuation-cost-input.ts`, Step 10 domain errors, public exports and `purchase-inventory-valuation-cost-input.test.ts`.
- Added architecture documentation in `purchase-inventory-valuation-cost-input.md`; receipt-before-invoice/provisional replacement policy remains Step 11.
- TDD RED was observed before implementation as `ERR_MODULE_NOT_FOUND` for the not-yet-created Step 10 module.
- Fresh Node 22 focused verifier after implementation: 5 tests passed, 0 failed, covering resolved cost, unresolved partial coverage, deterministic remainder allocation, provider adaptation and ineligible/mismatched source rejection.
- Fresh strict TypeScript source verification of the Step 10 implementation completed with exit code 0.
- Full package/monorepo validation remains owned by Steps 22–24 and is not claimed here.

## Step 11 Exit Criteria and Evidence

- Frozen policy: confirmed physical receipts may precede supplier invoices; missing Purchase cost does not block Inventory confirmation, but valuation remains explicitly unresolved.
- No automatic provisional/estimated cost and no silent zero-cost substitution are permitted.
- Derived unresolved reasons are `awaiting-supplier-invoice`, `partial-invoice-match`, and `supplier-invoice-cost-unavailable`.
- Movement-level quantity coverage is authoritative: only full confirmed invoice coverage for the movement may resolve Purchase-backed Cost Input.
- A later full invoice/match resolves through the existing Step 10 Cost Input builder rather than introducing a second cost-calculation path.
- Every unresolved or newly resolved decision declares `requiresRecalculation = true` with `recalculationReason = cost_basis_changed`; Steps 13–14 own the actual valuation command/UoW orchestration.
- Added `purchase-receipt-before-invoice-policy.ts`, public exports and `purchase-receipt-before-invoice-policy.test.ts`.
- Added architecture documentation in `purchase-receipt-before-invoice-policy.md`.
- TDD RED was established by defining the Step 11 test contract before the policy module existed.
- Direct repository clone/package execution from this session was attempted after implementation but could not run because the execution container could not resolve `github.com`; therefore no fresh full-package pass is claimed here. Local `pnpm --filter @argin/purchase test` and `typecheck` remain the authoritative executable verification until Steps 22–24.

## Step 12 Exit Criteria and Evidence

- Confirmed `purchase-return` and `purchase-correction` documents are durable compensating facts linked to a confirmed supplier invoice; Company and Supplier identity must match and the compensation reason is mandatory.
- Purchase returns create outbound Inventory intent for positive returned base quantity and cannot exceed the original line quantity. They do not mutate the original confirmed receipt movement or original Purchase Cost Input.
- Partial returns remain independent linked return documents; application orchestration decides whether cumulative coverage qualifies the original document for the terminal `returned` lifecycle state.
- Corrections support `commercial-replacement`, `quantity-decrease`, and `quantity-increase` effects. Quantity deltas produce outbound-compensation or inbound-follow-up Inventory intent instead of editing old movements.
- Commercial corrections affecting movements that already consumed authoritative Purchase cost declare `recalculationReason = cost_basis_changed` and list durable affected movement IDs for deterministic valuation replay.
- A correction with no affected historical movement does not request historical replay; its corrected commercial fact is used by later matching/cost resolution.
- Added `purchase-return-correction-workflow.ts`, Step 12 domain error codes, public exports and `purchase-return-correction-workflow.test.ts`.
- Added architecture documentation in `purchase-return-correction-workflow.md`; Steps 13–14 own persistence/application orchestration, Step 17 owns replay/idempotency semantics, and Phase 23 owns accounting reversal/posting.
- TDD RED was observed before implementation as `ERR_MODULE_NOT_FOUND` for the not-yet-created Step 12 module.
- Fresh full-package/monorepo validation is not claimed from this session; authoritative package verification remains `pnpm --filter @argin/purchase test` and `pnpm --filter @argin/purchase typecheck` locally until the formal validation gates in Steps 22–24.

## Change Requests

None.
