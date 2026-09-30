# Phase 24 — Sales Workflow — Fixed Implementation Plan

## Status

Steps 1–9 are complete. Steps 10–30 are not started.

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
| 10 | Discounts, Charges & Sales Tax | Not started |
| 11 | Deterministic Totals & Rounding | Not started |
| 12 | Commercial Snapshot & Historical Integrity | Not started |
| 13 | Sales Order | Not started |
| 14 | Sales Invoice | Not started |
| 15 | Sales Return | Not started |
| 16 | Sales Correction | Not started |
| 17 | Lifecycle, Status & Approval | Not started |
| 18 | Stock Sales -> Inventory Issue Integration | Not started |
| 19 | Sales Return -> Inventory Receipt Integration | Not started |
| 20 | Selling Price vs Inventory Cost/COGS Boundary | Not started |
| 21 | Sales Fulfillment & Matching | Not started |
| 22 | Idempotency, Replay Safety & Payload Fingerprint | Not started |
| 23 | Optimistic Concurrency & Version Control | Not started |
| 24 | SQLite Persistence, Migration & Transaction Boundary | Not started |
| 25 | Argin Bridge Contracts & Sync Readiness | Not started |
| 26 | Permissions, Audit & Traceability | Not started |
| 27 | Persian RTL Sales Workspace | Not started |
| 28 | Import/Export, Print/PDF & Operational Trace | Not started |
| 29 | Automated & E2E Validation | Not started |
| 30 | Documentation, Quality Gate, Merge & Release | Not started |

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
