# Phase 24 — Sales Workflow — Fixed Implementation Plan

## Status

Steps 1–24 are complete. Steps 25–30 are not started.

## Governance

The 30 step titles, order, scope and ownership boundaries are frozen at Phase 24 start. Any change requires an explicitly approved Change Request recorded in this canonical phase record. Owner acceptance and executable validation evidence remain separate.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Roadmap](../../ROADMAP.md)
- [Phase 17 — Parties](phase-17-parties.md)
- [Phase 18 — Products and Services](phase-18-products-services-plan.md)
- [Phase 20 — Inventory Documents](phase-20-inventory-documents-plan.md)
- [Phase 21 — Inventory Valuation](phase-21-inventory-valuation-plan.md)
- [Phase 23 — Purchase Posting](phase-23-purchase-posting-plan.md)
- [Commercial Pricing and Inventory Valuation Boundary](../architecture/commercial-pricing-and-valuation-boundary.md)

## Baseline and Release Target

- Baseline branch: `main`.
- Baseline commit: `91a1dc43fa7c341493d92b7e9457c1ecf0a117a8`.
- Baseline includes the Phase 23 merge to `main`.
- Phase branch: `phase/24-sales-workflow`.
- Target version: `0.24.0` / `v0.24.0`.
- Release title: `ArginAccounting v0.24.0 — Sales Workflow`.

## Mission

Phase 24 owns the commercial Sales workflow: customer-facing Sales pricing, commercial documents, deterministic commercial totals, lifecycle and fulfillment linkage to Inventory.

It keeps selling price and inventory cost as separate authorities. A Sales price is never an Inventory Cost Input. Confirmed stock fulfillment consumes Phase 20 Inventory public contracts; Phase 21 independently determines FIFO/MWA cost. Phase 25 later consumes Sales commercial facts and valuation outputs for accounting posting.

Canonical dependency direction:

```text
Party + Product/Service + Sales Pricing
                 ↓
         Phase 24 Sales Workflow
                 ↓
 Sales Order / Invoice / Return / Correction
                 ↓
      Inventory public contracts
                 ↓
 Phase 20 quantity + Phase 21 valuation
                 ↓
      Phase 25 Sales Posting (future)
```

## Ownership Boundaries

### Phase 24 owns

- Sales price lists and their commercial policy.
- Actual Sales document-line selling prices.
- Sales discounts, charges, tax inputs, currency and customer commercial context.
- Sales Order, Sales Invoice, Sales Return and Sales Correction commercial workflows.
- Commercial snapshots and historical Sales fact integrity.
- Sales lifecycle, approval integration, fulfillment/matching state and operational traceability.
- Durable Sales source identity and Argin Bridge-ready contracts.

### Phase 24 consumes but does not own

- Customer identity from Phase 17 Party Master Data.
- Product/Service identity, units and tax/master attributes from Phase 18.
- Warehouse/location and Inventory public quantity contracts from Phases 19–20.
- FIFO/MWA valuation and COGS cost authority from Phase 21.
- Shared Money, Number Series, Audit, Security, Approval, optimistic concurrency and background/platform infrastructure.

### Explicitly out of scope

- Revenue, Accounts Receivable, Output VAT, COGS or Inventory accounting posting; these belong to Phase 25.
- Treasury settlement, receipts, bank/cash operations and cheque workflows.
- Reimplementation of Inventory movement ownership or FIFO/MWA.
- Treating selling price as Inventory Cost Input.
- A single mutable Product sales-price field as the authoritative pricing model.
- General-purpose Posting Rules.
- Iranian Taxpayer submission/signing/inquiry.
- Live Argin Bridge transport, acknowledgement and conflict resolution; Phase 24 only preserves sync-ready contracts.
- PostgreSQL/server synchronization implementation.

## Core Invariants

- Product Master Data identifies what is sold; Sales owns transactional selling price.
- Customer references persist durable `partyId`; names/codes are display snapshots, not identity.
- Product references persist durable `productId`; SKU/name are not identity.
- Final Sales line price is a Sales commercial fact and never becomes an Inventory Cost Input.
- Inventory quantity authority remains Phase 20.
- Inventory cost/COGS authority remains Phase 21.
- Stock fulfillment uses Inventory public application contracts; Sales must not write Inventory tables directly.
- Services/non-stock items do not create Inventory issue movements solely because they are sold.
- Finalized commercial facts are immutable in place; returns/corrections create explicit lineage.
- Monetary calculations use shared Money/decimal rules and deterministic rounding.
- Multi-write confirmation/fulfillment operations must be atomic.
- Same durable mutation identity and payload must be idempotent; replay must not duplicate business effects.
- Same identity with incompatible payload/version must conflict rather than silently overwrite.
- Optimistic concurrency protects mutable drafts and lifecycle transitions.
- Missing required upstream references or pricing inputs fail explicitly; no silent zero/default commercial facts.
- Phase 24 must remain persistence-neutral above adapters and offline-first on SQLite.
- All new durable identities/version/change metadata must remain compatible with future Argin Bridge synchronization.

## Argin Bridge Boundary

Phase 24 prepares durable, persistence-neutral Sales contracts for the future path:

```text
Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization
```

The phase therefore preserves stable IDs, source/external references, version/change metadata, operation/idempotency identity, immutable commercial snapshots and correction lineage. It does not implement live remote synchronization.

## Fixed 30-Step Plan

| Step | Title | Status |
| ---: | --- | --- |
| 1 | Baseline, Scope & Ownership Boundaries | Completed |
| 2 | Sales Domain Model & Aggregates | Completed |
| 3 | Durable Document, Line & Source Identity | Completed |
| 4 | Customer & Party Master Integration | Completed |
| 5 | Sales Price List Model | Completed |
| 6 | Price List Resolution Policy | Completed |
| 7 | Effective Dating, Currency & Price Versioning | Completed |
| 8 | Base, Wholesale & Customer/Segment Pricing | Completed |
| 9 | Sales Commercial Terms | Completed |
| 10 | Discounts, Charges & Sales Tax | Completed |
| 11 | Deterministic Totals & Rounding | Completed |
| 12 | Commercial Snapshot & Historical Integrity | Completed |
| 13 | Sales Order | Completed |
| 14 | Sales Invoice | Completed |
| 15 | Sales Return | Completed |
| 16 | Sales Correction | Completed |
| 17 | Lifecycle, Status & Approval | Completed |
| 18 | Stock Sales -> Inventory Issue Integration | Completed |
| 19 | Sales Return -> Inventory Receipt Integration | Completed |
| 20 | Selling Price vs Inventory Cost/COGS Boundary | Completed |
| 21 | Sales Fulfillment & Matching | Completed |
| 22 | Idempotency, Replay Safety & Payload Fingerprint | Completed |
| 23 | Optimistic Concurrency & Version Control | Completed |
| 24 | SQLite Persistence, Migration & Transaction Boundary | Completed |
| 25 | Argin Bridge Contracts & Sync Readiness | Not started |
| 26 | Permissions, Audit & Traceability | Not started |
| 27 | Persian RTL Sales Workspace | Not started |
| 28 | Import/Export, Print/PDF & Operational Trace | Not started |
| 29 | Automated & E2E Validation | Not started |
| 30 | Documentation, Quality Gate, Merge & Release | Not started |

## Step 24 — SQLite Persistence, Migration & Transaction Boundary

- Added persistence-neutral Sales repository and Unit-of-Work ports for durable document/lifecycle state and idempotency records.
- Added `@argin/sales-tauri` as the desktop SQLite adapter package, following the existing Purchase/Inventory adapter separation.
- Added migration `0035_sales_workflow.sql` and registered migration version 35 in the Tauri desktop migration list.
- `sales_documents` persists durable Sales aggregate identity, scope, customer, type/status, immutable document JSON, aggregate version, timestamps and sync-origin/change metadata.
- `sales_document_lifecycle` persists append-only transition identity/history with a Company-scoped unique transition ID and document FK.
- `sales_idempotency` persists request ID, operation ID, operation name, payload fingerprint and exact committed result JSON; both request and operation identities are independently unique within Company scope.
- SQLite document updates use real compare-and-swap: `UPDATE ... WHERE company_id=? AND id=? AND version=?`. A zero-row update becomes `sales.concurrency_conflict`.
- Repository updates require the supplied next aggregate version to equal `expectedVersion + 1`; successful writes therefore advance version exactly once.
- `SqliteSalesUnitOfWork` binds Sales document and idempotency repositories to the same pinned DatabaseSession. The production `@argin/database-tauri` transaction implementation supplies `BEGIN IMMEDIATE / COMMIT / ROLLBACK`, allowing mutation state and replay truth to commit atomically.
- Added adapter tests for SQL CAS, zero-row conflict, lifecycle append, exact idempotency envelope persistence and single-session UoW; added a desktop migration contract test for tables, JSON constraints, operation uniqueness and migration registration.
- Step 24 intentionally persists the current Sales aggregate/lifecycle/replay truth only. Argin Bridge envelopes/sync contracts remain Step 25, permissions/audit Step 26 and UI Step 27.

## Step 23 — Optimistic Concurrency & Version Control

- Added persistence-neutral `SalesVersionedAggregate<T>` and compare-and-swap helpers with mandatory positive safe-integer versions.
- Every new mutable Sales operation is expected to carry `expectedVersion`; a mismatch fails explicitly with `sales.concurrency_conflict` before the mutation callback executes.
- Successful CAS increments the aggregate version exactly once and leaves the prior immutable value/version unchanged.
- Added a version-aware Sales lifecycle wrapper so Submit/Approve/Reject/Finalize/Cancel transitions can participate in the same aggregate concurrency model without duplicating lifecycle rules.
- Replay ordering from Step 22 is now executable: `prepareSalesMutation` performs idempotency/replay resolution first and only checks `expectedVersion` for a genuinely new mutation.
- Therefore an exact retry of a committed request can replay its original result even if the aggregate has since advanced to a newer version; a new request against a stale version still conflicts.
- Idempotency and optimistic concurrency remain distinct controls: identity/fingerprint protects retries, while CAS protects concurrent edits/commands.
- SQLite row-level compare-and-swap persistence (for example `UPDATE ... WHERE version = expectedVersion`) is deferred to Step 24, where repository/UoW transaction semantics are implemented.
- Added focused tests for successful CAS, stale-write rejection without mutation execution, lifecycle version increments, concurrent lifecycle conflict, invalid versions, exact replay-before-version behavior and stale new-mutation rejection.

## Step 22 — Idempotency, Replay Safety & Payload Fingerprint

- Added a normalized `SalesMutationContext` carrying Company, Branch, durable `requestId`, durable `operationId`, normalized operation name, `payloadFingerprint`, actor and canonical UTC occurrence time.
- Added dual-key replay lookup contracts. Both request identity and operation identity are checked independently within the Company boundary so accidental cross-linking cannot silently replay the wrong mutation.
- A mutation with no prior identity is classified as `execute`. An exact committed retry with matching request ID, operation ID, operation and payload fingerprint is classified as `replay`.
- Reuse of either durable identity with a different peer identity, operation name or payload fingerprint fails explicitly with `sales.idempotency_conflict`.
- Added append-oriented `SalesIdempotencyRecord` contracts with outcome kind/ID, optional version/status and exact committed `resultJson`. Replay returns this exact stored response rather than reloading later aggregate state.
- Exact replay semantics are intentionally evaluated before future optimistic-version checks. Step 23 adds aggregate version/CAS rules; idempotency does not replace concurrency control.
- The same request/operation/fingerprint identities are deliberately suitable for Step 25 Argin Bridge envelopes so local replay truth and future synchronization do not invent competing mutation identities.
- Repository persistence and atomic transaction wiring are deferred to Step 24; this step freezes the persistence-neutral semantics and repository ports.
- Added focused tests for first execution, exact replay, changed-payload conflict, request/operation identity reuse conflicts, crossed identities, canonical UTC normalization and malformed stored result protection.

## Step 21 — Sales Fulfillment & Matching

- Added deterministic line-level quantity matching for `Sales Order -> Sales Invoice` and `Sales Invoice -> Sales Return`.
- Matching is based on durable Sales document/line identity, not document numbers, descriptions, product-name text or UI position.
- Order fulfillment aggregates quantities across all supplied related invoices per source order line and exposes matched, remaining and complete state.
- Cumulative invoiced quantity above the originating order-line quantity fails explicitly with `sales.fulfillment_over_invoice`.
- Return matching aggregates quantities across all supplied Sales Return documents per originating invoice line and exposes remaining returnable quantity.
- Cumulative returned quantity above the originating invoice-line quantity fails explicitly with `sales.fulfillment_over_return`; splitting an excessive return across multiple return documents cannot bypass the control.
- Related-document identity, source-line identity, Product identity and line classification must remain consistent across each matching chain.
- Step 21 is a deterministic domain calculation over supplied immutable documents; persistence/query ownership for discovering the complete related-document set remains with later application/persistence steps.
- Inventory Issue/Receipt creation remains owned by Steps 18/19. Matching does not derive Inventory Cost, Selling Price or accounting postings.
- Added focused tests for partial/complete fulfillment, cumulative over-invoice, bad source identity, partial return capacity and cumulative over-return.

## Step 20 — Selling Price vs Inventory Cost/COGS Boundary

- Formalized the commercial-price versus inventory-cost boundary as executable Sales contracts rather than documentation-only guidance.
- `SalesCommercialAmountFact` is derived exclusively from the immutable Sales Commercial Snapshot and exposes selling quantity/price, discounts, charges, tax and Grand Total without any Inventory Cost or COGS field.
- `SalesInventoryCostFact` is derived exclusively from a resolved Phase 21 `InventoryValuationEntrySnapshot` of kind `outbound`; Sales invoice prices cannot be supplied as its cost source.
- Inventory cost lineage must match the durable Sales line identity carried through the Inventory Issue source line. A valuation entry for another line is rejected.
- Cost facts retain Inventory movement ID, valuation-entry ID, valuation method and revision so Phase 25 can consume authoritative, explainable COGS inputs.
- Unresolved valuation and non-outbound valuation are explicitly rejected as COGS/cost sources. Sales does not silently substitute zero cost, selling price or another commercial amount.
- Selling Price and Inventory Cost remain independent even when their numeric values happen to be equal. Their source, ownership and accounting meaning remain distinct.
- Step 20 does not create accounting entries. Phase 25 will join Sales commercial facts with Inventory valuation facts to produce Revenue/Tax/Receivable and COGS/Inventory Relief.
- Added focused tests proving source separation, differing selling/cost values, rejection of unresolved/non-outbound valuation and lineage mismatch protection.

## Step 19 — Sales Return -> Inventory Receipt Integration

- Added a Sales application gateway that maps finalized stock Sales Returns to Phase 20's public `InventorySourceDocumentPort` as Inventory `receipt` drafts.
- Only a `finalized` Sales Return with lifecycle identity matching that same return may stage a receipt.
- Only returned `stock-product` lines cross the quantity boundary; returned services and non-stock products do not create stock receipts.
- Every returned stock line requires exact operational routing (Inventory unit + Warehouse), and routing must cover every and only stock-return line.
- Inventory source identity is the durable Sales Return document/line identity. Because each Sales Return line already references its originating Sales Invoice line, audit lineage remains `Inventory Receipt <- Sales Return Line <- Sales Invoice Line`.
- The returned commercial quantity crosses into Inventory, but selling price, discounts, charges, VAT and Grand Total never become Inventory receipt cost inputs.
- Inventory remains authoritative for receipt draft lifecycle, approval, confirmation, movement facts, stock projection, concurrency and transaction boundaries.
- Step 19 deliberately does not assign return valuation/cost from Sales commercial amounts. Inventory valuation and later COGS reversal/correction remain independent concerns of Phase 21/25.
- Added focused tests for stock-only receipt mapping, return lineage, finalized-return requirement, exact routing, no-stock behavior and absence of monetary Sales fields from the Inventory request.

## Step 18 — Stock Sales -> Inventory Issue Integration

- Added a Sales application gateway that consumes Phase 20's public `InventorySourceDocumentPort`; Sales never writes Inventory documents, movements, ledgers or balance projections directly.
- Only a `finalized` Sales Invoice with a lifecycle state belonging to that same invoice may stage an Inventory Issue.
- Only `stock-product` invoice lines are mapped to the Inventory `issue` request. Non-stock products and services are deliberately excluded.
- Each stock line requires explicit operational routing (Inventory unit + Warehouse reference); routing must match every and only stock line.
- Durable lineage is preserved: Inventory source system/type/document ID identify the Sales Invoice and each Inventory source line uses the durable Sales line ID.
- The quantity crossing the boundary is the Sales commercial quantity; selling price, discount, charge, tax, Grand Total and other monetary facts never cross into the Inventory quantity request.
- Inventory remains authoritative for its own draft lifecycle, approval, confirmation, negative-stock policy, stock ledger, movement identity, concurrency and transaction boundary.
- Step 18 stages the Issue through the Inventory public contract; it does not bypass Inventory approval/confirmation or directly invoke FIFO/MWA. Phase 21 valuation remains the independent cost authority.
- Added focused tests proving stock-only mapping, source lineage, finalized-invoice requirement, exact operational routing and the absence of selling-price/tax fields from the Inventory request.

## Step 17 — Lifecycle, Status & Approval

- Added a shared persistence-neutral Sales lifecycle state machine for Sales Order, Invoice, Return and Correction.
- Every Sales document begins in `draft`; the canonical confirmation path is `draft -> submitted -> approved -> finalized`.
- Supported review paths are explicit: Submitted or Approved documents may be rejected back to Draft; Draft/Submitted/Approved documents may be cancelled.
- `finalized` and `cancelled` are terminal states. Invalid skips such as Draft -> Approved and mutations after terminal state fail explicitly.
- Status never changes without an immutable transition fact carrying durable `transitionId`, document identity/type, from/to status, action, actor, timestamp and optional reason.
- Duplicate transition identity fails explicitly, preparing the lifecycle contract for later replay/idempotency enforcement in Step 22.
- Approval is represented as an explicit domain transition rather than a UI-only flag. Permission enforcement for who may submit/approve/finalize/cancel remains Step 26.
- Finalization in Step 17 establishes commercial lifecycle finality only; it does not itself create Inventory movements or accounting postings. Those effects are owned by Steps 18/19/21 and Phase 25.
- Optimistic version checks are intentionally deferred to Step 23 rather than being mixed into the lifecycle primitive.
- Added focused tests for the canonical path, rejection, cancellation, invalid transition skips, terminal-state protection, duplicate transition IDs and timestamp validation.

## Step 16 — Sales Correction

- Added the dedicated `SalesCorrection` aggregate with document type fixed to `sales-correction`.
- A correction is a new durable commercial fact with its own document/line identities; it never edits, replaces or rewrites the originating Sales Invoice or its historical Commercial Snapshots.
- A Sales Correction requires at least one complete corrected commercial line.
- Every correction must reference an originating `sales-invoice` at document level, and every correction line must reference a concrete line of that same invoice through durable Sales source identity.
- Corrected quantity, selling price, discounts, charges and taxes are captured in new immutable Step 12 Commercial Snapshots; deterministic totals are recalculated through the Step 11 engine.
- The original invoice remains authoritative for what was originally issued; the correction preserves explicit lineage for later delta/reversal accounting rather than mutating history.
- Step 16 deliberately does not decide lifecycle/finalization, Inventory movement deltas, Accounts Receivable/VAT adjustments or Journal Voucher effects. Lifecycle belongs to Step 17 and accounting effects belong to Phase 25.
- Added focused tests for independent correction identity, invoice/line lineage, empty correction rejection, wrong/missing invoice origin, cross-invoice lineage, missing corrected Commercial Terms and absence of direct Inventory/accounting side effects.

## Step 15 — Sales Return

- Added the dedicated `SalesReturn` aggregate with document type fixed to `sales-return`.
- A Sales Return requires at least one complete commercial line; empty returns and lines without Commercial Terms fail explicitly.
- Every Sales Return must reference an originating `sales-invoice` at document level. A return cannot be created as an unanchored commercial document.
- Every return line must carry a durable Sales source reference to a concrete line of that same originating invoice. Cross-invoice or missing line lineage fails explicitly.
- Return creation captures immutable Step 12 Commercial Snapshots and derives return totals through the Step 11 deterministic pricing engine.
- The return owns its own commercial facts (returned quantity, selling-price context, discounts/charges/taxes) while preserving immutable lineage to the original invoice facts.
- Step 15 does not create Inventory Receipt, reverse COGS, adjust Accounts Receivable, post Output VAT reversal or create a Journal Voucher.
- Inventory re-entry belongs to Step 19, fulfillment/matching and over-return controls belong to Step 21, and accounting reversal/correction effects belong to Phase 25.
- Added focused tests for valid invoice/line lineage, empty-return rejection, wrong/missing invoice origin, cross-invoice line rejection, missing Commercial Terms and absence of Inventory/accounting side effects.

## Step 14 — Sales Invoice

- Added the dedicated `SalesInvoice` aggregate on top of the shared Sales document primitives with document type fixed to `sales-invoice`.
- A Sales Invoice requires at least one complete commercial line; empty invoices and lines without Commercial Terms fail explicitly.
- Invoice creation captures immutable Step 12 Commercial Snapshots and derives document totals exclusively through the Step 11 deterministic pricing engine.
- Invoice/document and line-level lineage can preserve originating Sales Order identity through durable `relatedDocumentReference` and `sourceReference` contracts without copying or mutating the original order.
- Stock-product, non-stock-product and service lines are valid invoice commercial facts while preserving their distinct classification.
- Step 14 records commercial invoice facts only. It does not directly create Inventory Issue, COGS, Accounts Receivable, Output VAT posting or Journal Voucher.
- Inventory fulfillment belongs to Steps 18/21; lifecycle/approval belongs to Step 17; revenue/receivable/tax/COGS accounting belongs to Phase 25.
- Order-to-invoice quantity allocation and matching are intentionally deferred to Step 21 rather than being partially implemented here.
- Added focused tests for invoice creation, order/line lineage, snapshots/totals, supported line classifications, empty/missing-commercial-fact rejection and absence of Inventory/accounting side effects.

## Step 13 — Sales Order

- Added the dedicated `SalesOrder` aggregate on top of the shared Sales document primitives; callers do not supply or mutate another document type when creating an order.
- A Sales Order requires at least one commercial line. Empty orders fail explicitly.
- Every order line must contain valid Sales Commercial Terms; structural lines without selling-price/quantity facts cannot become a Sales Order.
- Order creation captures one immutable Step 12 Commercial Snapshot per line using deterministic snapshot identity derived from durable order/line IDs.
- Document totals are derived exclusively from the captured line totals through the Step 11 deterministic pricing engine.
- Stock-product, non-stock-product and service lines are all valid commercial order lines while preserving their distinct Product/Service classification.
- Customer identity remains the canonical Phase 17 Party `partyId`; Product/Service identity remains durable `productId`.
- Sales Order creation deliberately has no Inventory Issue, COGS, journal or receivable side effect. Fulfillment belongs to Steps 18/21 and accounting belongs to Phase 25.
- Lifecycle status, submit/approve/finalize/cancel behavior remains Step 17; Step 13 establishes the order-specific aggregate and completeness rules only.
- Added focused tests for aggregate creation, snapshots/totals, all line classifications, empty-order rejection, missing Commercial Terms and absence of Inventory/accounting effects.

## Step 12 — Commercial Snapshot & Historical Integrity

- Added durable `SalesCommercialSnapshot` identity per captured line commercial fact, preserving line ID, Product ID, line kind and capture timestamp.
- Snapshot creation requires authoritative line Commercial Terms; incomplete structural lines cannot silently become historical commercial facts.
- Commercial Terms are rebuilt through domain factories into an independent immutable snapshot rather than retaining caller-owned mutable references.
- Captured terms preserve actual quantity, currency, selling price, price origin/revision lineage, ordered discounts/charges and Sales tax inputs.
- Step 11 deterministic line totals are calculated at capture time and retained beside their authoritative inputs for historical display/audit.
- Added `verifySalesCommercialSnapshot` to deterministically recalculate totals from captured facts and detect persisted/tampered total inconsistencies.
- Later Price List or master-data changes do not re-resolve or rewrite an existing snapshot; historical selling-price provenance remains the captured revision/manual fact.
- Snapshot scope deliberately excludes Inventory Cost, COGS and accounting posting, preserving the Phase 21/25 ownership boundary.
- Added focused tests for immutable capture, historical price independence, missing Commercial Terms, totals-integrity verification and invalid timestamps.
- Document-type finalization and when snapshots become mandatory/locked are owned by Steps 13–17; Step 12 provides the immutable commercial-history primitive.

## Step 11 — Deterministic Totals & Rounding

- Added a pure persistence-neutral Sales pricing engine that derives line and document totals exclusively from authoritative Sales Commercial Terms.
- Fixed calculation order as `Gross -> ordered Discounts -> Net After Discount -> ordered Charges -> Tax Base -> Taxes -> Grand Total`.
- Quantity × unit-price and all basis-point calculations use integer/BigInt arithmetic with the project-aligned `half-away-from-zero` monetary rounding rule; floating-point monetary arithmetic is not used for derived amounts.
- Ordered percentage discounts apply to the current amount after preceding discounts. Ordered percentage charges apply to the current amount after discounts and preceding charges.
- Each Sales tax is calculated from the final Tax Base and rounded deterministically; tax amounts are summed before Grand Total.
- A discount that exceeds the current amount fails explicitly instead of producing a negative commercial base.
- Added document-total aggregation with explicit same-currency enforcement and safe-integer overflow protection.
- Added focused tests for the canonical 2.5 × 100 / 10% discount / 20 charge / 10% VAT scenario, half rounding boundaries, ordered adjustments, excessive discount rejection, document aggregation and mixed-currency rejection.
- Calculated totals remain derived facts, not a new pricing authority. Step 12 owns the immutable historical Commercial Snapshot that will preserve the finalized inputs/results.

## Step 10 — Discounts, Charges & Sales Tax

- Added immutable Sales-owned line inputs for discounts, charges and Sales taxes without prematurely calculating monetary totals.
- Discounts and charges support explicit `amount` and `percent` modes. Percentage values use integer basis points (`1000 = 10%`, `750 = 7.5%`) to avoid floating-point percentage storage.
- Amount adjustments use the same non-negative safe-integer monetary boundary as current Sales unit prices; currency remains inherited from the owning commercial terms.
- Sales tax inputs preserve durable `taxId`, integer `rateBasisPoints` and optional `taxCode`; Tax Base and Tax Amount are deliberately not stored as Step 10 inputs.
- Commercial terms now carry immutable `discounts[]`, `charges[]` and `taxes[]` collections.
- Adjustment/tax identities must be unique within a line commercial fact, preventing ambiguous downstream calculation/audit references.
- Added validation for adjustment mode/value, percentage/rate range `0..10000` basis points, tax rates and duplicate identities.
- Added focused tests for fixed/percentage adjustments, VAT-style tax input, immutable attachment to commercial terms, invalid rates and duplicate identities.
- Step 11 remains the sole owner of calculation order, tax base, gross/net/tax/grand-total arithmetic and deterministic rounding.

## Step 9 — Sales Commercial Terms

- Added immutable `SalesCommercialTerms` as the Sales-owned commercial fact attached to a document line.
- Commercial terms capture positive quantity, three-letter currency, unit selling price and explicit price origin without introducing Inventory Cost, COGS or accounting state.
- Supported two explicit origins: `price-list` and `manual`. Manual negotiated prices carry no fabricated price-list lineage.
- Price-list-origin terms preserve `priceListId`, `priceListItemId`, `priceRevisionId` and revision number so the actual selling-price source remains traceable after later list changes.
- Added `createSalesCommercialTermsFromResolvedPrice` to convert the authoritative Step 6–8 resolution result into a line commercial fact without re-resolving or copying pricing rules.
- Sales document lines can now carry optional immutable commercial terms; structural line creation remains usable while later document-specific completeness rules are deferred to Steps 13–16.
- Added validation for positive finite quantity, non-negative safe-integer unit price, currency format and internally consistent price-origin metadata.
- Added focused tests for manual terms, resolved-price lineage, invalid quantity/origin combinations and the explicit absence of Inventory Cost/COGS/discount/tax concerns.
- Discounts, charges and Sales tax remain Step 10. Deterministic gross/net/tax/grand-total arithmetic and rounding remain Step 11.

## Step 8 — Base, Wholesale & Customer/Segment Pricing

- Added explicit Sales-owned price-list targeting for `base`, `wholesale`, `customer` and `segment` lists.
- `customer` targeting references the canonical Party Master exclusively through durable `customerPartyId`; no duplicate Customer master or mutable Party code/name identity is introduced.
- `segment` targeting stores a durable `customerSegmentId` while segment membership is supplied through a persistence-neutral `SalesPricingContext`.
- `wholesale` eligibility is an explicit Sales pricing-context fact rather than inferred from price amount or Product state; `base` remains universally eligible.
- Target shape is validated by list kind: base/wholesale cannot carry customer/segment targets, customer requires Party id, and segment requires Segment id.
- Step 6 resolver now derives concrete target eligibility from `SalesPricingContext` while retaining deterministic priority `customer -> segment -> wholesale -> base` and Step 7 date/currency revision filtering.
- Existing explicit `eligible` candidates remain supported as a lower-level boundary; an explicit false always excludes a list.
- Added focused tests for target contracts, invalid target combinations, each eligibility rule and full priority fallback across customer/segment/wholesale/base.
- Tier/quantity-break and discount mechanics remain future pricing-rule extensions; Step 9 begins document-line commercial terms and does not mutate these price-list ownership rules.

## Step 7 — Effective Dating, Currency & Price Versioning

- Replaced mutable item-level selling price with immutable `SalesPriceRevision` history carrying durable `priceRevisionId`, monotonic revision number, ISO-style three-letter currency, unit price and inclusive effective-date window.
- Price-list items now retain revision history instead of overwriting the previous selling price.
- Added validation for revision identity/number, non-negative safe-integer monetary amount, currency format, Gregorian effective dates and invalid date ranges.
- Duplicate revision identities/numbers and overlapping effective windows within a Product price history fail explicitly.
- Extended Step 6 resolution so the requested Sales business date and currency select the effective revision while preserving the existing list-kind priority.
- Resolution output now includes revision identity/number, currency and effective window for downstream Sales commercial traceability.
- Added focused tests proving historical old/new price reconstruction, currency filtering, invalid metadata rejection and overlap/duplicate protection.
- Step 8 remains the owner of concrete customer/segment/wholesale/base qualification semantics; this step only makes temporal/currency eligibility authoritative.

## Step 6 — Price List Resolution Policy

- Added a pure, persistence-neutral Sales price-list resolver with deterministic priority: `customer -> segment -> wholesale -> base`.
- Resolution consumes explicit eligibility supplied by the owning context rather than duplicating Customer/Segment qualification rules before Step 8.
- Resolver ignores inactive lists, falls through when a higher-priority list does not contain the requested Product, and returns `null` when no eligible price exists.
- Enforced Company scope; cross-Company candidate lists fail explicitly.
- Multiple eligible matches for the same Product at the same priority fail with `sales.price_resolution_ambiguous` instead of depending on query/array order.
- Resolution result preserves `priceListId`, `priceListItemId`, kind, `productId` and `unitPrice` for downstream commercial traceability.
- Added focused tests for priority, input-order independence, eligibility, inactive lists, Product fallback, no-match behavior, ambiguity and Company-scope rejection.
- Step 7 remains the owner of effective-date, currency and price-version eligibility. Step 8 remains the owner of concrete base/wholesale/customer/segment qualification semantics.

## Step 5 — Sales Price List Model

- Added the independent Sales-owned `SalesPriceList` aggregate; Product Master remains free of authoritative mutable Sales prices.
- Added durable `priceListId` and `priceListItemId` identities plus explicit Company scope and human-facing code/name metadata.
- Added structural price-list kinds `base`, `wholesale`, `customer`, and `segment` without prematurely implementing resolution priority or eligibility rules.
- Price-list items reference Product/Service Master exclusively through durable `productId`.
- Added non-negative safe-integer `unitPrice` validation consistent with the current Rial-oriented monetary boundary while keeping currency/effective dating in their fixed owner Step 7.
- Rejected duplicate item identities and duplicate Product entries within one price list.
- Explicitly kept Inventory Cost, COGS and accounting/posting state outside Sales pricing.
- Added focused tests for kinds, Company scope, durable Product references, duplicate rejection, invalid prices and the selling-price/Inventory-cost boundary.
- Step 6 remains the owner of price-list resolution/priority. Step 7 owns effective dates, currency and price versioning. Step 8 owns base/wholesale/customer/segment eligibility semantics.

## Step 4 — Customer & Party Master Integration

- Integrated Sales with the canonical Phase 17 `@argin/party` selection contract rather than creating a duplicate Customer master.
- Added `createSalesCustomerSnapshot(PartySelectionReference)`; only a Party carrying the `customer` role is eligible for Sales customer selection.
- Kept durable `partyId` as the sole customer foreign identity. Party `code` and `displayName` are persisted only as immutable Sales display snapshots.
- Updated `CreateSalesDocumentInput` to consume an explicit `SalesCustomerSnapshot`, making the identity/display boundary visible at the aggregate boundary.
- Added focused tests proving customer-role enforcement, absence of a parallel customer identity, and historical snapshot stability when Party display metadata changes later.
- Kept Party lifecycle/status authorization in the Party selection/application boundary; Sales does not copy Party ownership rules.
- Customer-specific pricing remains owned by Steps 5–8 and is not introduced by this integration step.
- Live Bridge synchronization remains deferred; this step preserves the durable `partyId` dependency needed by future sync contracts.

## Step 3 — Durable Document, Line & Source Identity

- Confirmed `documentId` and `lineId` as durable business identities independent from mutable/display-oriented document numbering.
- Added persistence-neutral `SalesSourceReference` at document and line level with `sourceSystem`, `sourceDocumentId` and optional `sourceLineId`.
- Added `SalesRelatedDocumentReference` for explicit correction/return/future fulfillment lineage using durable document/line IDs rather than names or document numbers.
- Added explicit self-reference protection for native Sales references while permitting an external system to reuse an opaque identifier without false collision.
- Exported the new identity contracts from `@argin/sales`.
- Added focused tests for document-number independence, document/line source identity, lineage references and self-reference rejection.
- Kept operation idempotency keys, replay payload fingerprints and mutation conflict semantics in their fixed owner Step 22.
- Kept optimistic version/change metadata in Step 23 and full Argin Bridge sync-readiness contracts in Step 25; Step 3 supplies their durable identity foundation only.

## Step 2 — Sales Domain Model & Aggregates

- Added the independent `@argin/sales` package at version `0.24.0`.
- Established the Sales document aggregate and structural domain errors without coupling Sales to UI, SQLite or accounting.
- Froze four commercial document kinds: `sales-order`, `sales-invoice`, `sales-return`, and `sales-correction`.
- Froze three line classifications: `stock-product`, `non-stock-product`, and `service`.
- Added company/Branch/fiscal scope plus durable `partyId` customer and `productId` item references as structural identities. Rich Party/Product snapshot integration remains Steps 4 and later.
- Added structural invariants for required identities, valid Gregorian business date, line classification, unique line IDs and unique line positions.
- Added focused domain tests for document kinds, aggregate creation, line ordering, duplicate rejection, classification and business-date validation.
- Explicitly kept Sales pricing, Inventory cost, accounting posting, lifecycle, persistence and live Bridge behavior out of the Step 2 aggregate; their fixed owning steps remain unchanged.
- Step 3 remains the owner of richer durable document/line/source identity semantics.

## Step 1 — Baseline, Scope & Ownership Boundaries

- Verified canonical Roadmap ownership and Phase 24 Sales Workflow scope.
- Verified Phase 23 is merged into `main`.
- Pinned Phase 24 baseline to `91a1dc43fa7c341493d92b7e9457c1ecf0a117a8`.
- Created `phase/24-sales-workflow` from that exact baseline.
- Froze the 30-step implementation plan.
- Froze Sales/Inventory/Valuation/Posting ownership boundaries.
- Froze the Argin Bridge rule: durable sync-ready identity/contracts now; live transport later.
- Set semantic release target to `v0.24.0`.
- No Sales domain implementation is introduced in Step 1; Step 2 owns the first domain model.
