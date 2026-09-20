# Commercial Pricing and Inventory Valuation Boundary

## Purpose

This document freezes the ownership boundary between Purchases, Sales and Inventory Valuation so later phases do not duplicate or misplace commercial pricing logic.

The rule is simple:

- Purchases owns supplier purchase prices and commercial purchase amounts.
- Sales owns sales prices, price lists and the actual selling price on sales documents.
- Inventory Valuation owns inventory cost derived from authoritative inbound Cost Inputs plus the Company valuation policy.

These concepts may be numerically related, but they are not the same data and must not share ownership.

## Phase ownership

### Phase 21 — Inventory Valuation

Phase 21 owns:

- the authoritative inbound `Cost Input` consumed by FIFO or Moving Weighted Average;
- deterministic valuation of confirmed inventory movements;
- unresolved-cost diagnostics;
- manual/fallback resolution only for movements that do not receive cost from an upstream commercial source;
- controlled historical cost correction with Audit, idempotency, optimistic concurrency and deterministic recalculation;
- traceability from Movement -> Cost Input -> Policy -> Valuation Entry/Layer/State.

Phase 21 does **not** own:

- supplier invoices;
- vendor commercial terms;
- normal day-to-day purchase-price entry;
- sales price lists;
- sales invoice pricing;
- accounting posting for purchase or sales documents.

The manual valuation UI is therefore an **exception and repair surface**, not the normal purchase-pricing workflow.

Eligible manual/fallback cases include:

- opening inventory;
- legacy receipts created before Purchase integration exists;
- migration/import;
- manual warehouse receipt without a Purchase source;
- external ERP/import source that has not supplied cost;
- controlled correction of a historically wrong inbound Cost Input.

A normal receipt linked to a valid Purchase invoice should receive its Cost Input automatically and should not require the user to re-enter the purchase price in Inventory Valuation.

## Phase 22 — Purchase Workflow

Phase 22 must implement the commercial Purchase document flow and becomes the primary owner of purchase-price capture.

For each Purchase line the workflow must preserve at least:

- supplier / Party reference;
- product/service reference;
- commercial quantity and unit;
- unit purchase price;
- line discount;
- line charges where applicable;
- invoice-level discount/charges and deterministic allocation policy where applicable;
- tax/VAT inputs;
- currency and exchange-rate context when multi-currency support applies;
- links to the related inventory receipt/movement for stock items;
- durable source identity for Argin Bridge and Audit.

For stock items, the expected normal flow is:

`Purchase Invoice / Purchase Receipt Commercial Source -> confirmed Inventory Movement -> authoritative Cost Input -> Inventory Valuation`

The user enters the supplier price once in the Purchase workflow. Inventory Valuation must consume the resulting Cost Input automatically and must not request the same price again.

Purchase line amount is a commercial fact. The value supplied to Inventory Valuation may include the purchase base amount plus only those landed-cost components that policy explicitly capitalizes into inventory cost.

Services and non-stock items do not create stock Cost Inputs merely because they appear on a Purchase invoice.

### Receipt-before-invoice scenario

Phase 22 must support the case where goods physically arrive before the final supplier invoice.

The workflow must explicitly choose one supported policy, for example:

- keep valuation unresolved until the commercial amount is known; or
- provide an approved provisional/estimated Cost Input and later replace it through the controlled correction/recalculation contract.

The system must never silently use zero cost.

### Purchase price changes

A higher supplier price on a future purchase creates a new Purchase line and a new Cost Input for that future receipt. It must not rewrite historical Cost Inputs.

If the original Purchase invoice itself was wrong and is formally corrected, Purchase must issue the appropriate correction/reversal/replacement event and Inventory Valuation must recalculate from the earliest affected chronology point.

## Phase 23 — Purchase Posting

Phase 23 owns accounting recognition generated from the Purchase workflow and valuation results.

It must consume, not duplicate, the authoritative facts established by Phases 21 and 22.

Responsibilities include:

- supplier payable recognition;
- purchase/VAT accounting effects;
- inventory/GRNI or equivalent interim-account treatment when configured;
- landed-cost/accounting treatment;
- purchase correction/reversal posting;
- reconciliation between Purchase commercial amounts and Inventory Valuation amounts;
- PostingRequest/idempotency/source-integrity contracts.

Phase 23 must not create a second independent purchase-price store.

## Phase 24 — Sales Workflow

Phase 24 owns commercial sales pricing.

It must provide a Sales pricing model separate from inventory cost. The design must support an extensible price-list boundary, for example:

- base/default price;
- wholesale price;
- customer/segment-specific price;
- effective-from / effective-to dates;
- currency;
- quantity/tier pricing where later required;
- discounts and promotions as explicit commercial rules;
- actual Sales invoice line price as the final commercial fact for that sale.

A Product master must not contain one mutable field that is treated as the only authoritative sales price for all contexts.

The actual Sales invoice price may be derived from a price list and then adjusted by authorized discount rules. The final invoice-line price belongs to Sales.

Sales price never becomes an Inventory Valuation Cost Input.

When a stock sale confirms an inventory issue, Inventory Valuation determines the cost of goods sold from FIFO/MWA independently of the selling price.

Example:

- Purchase/Inbound cost: 25,000,000 IRR
- Current FIFO/MWA inventory cost: 26,200,000 IRR
- Sales list price: 32,000,000 IRR
- Actual Sales invoice price: 31,500,000 IRR

These values are intentionally separate.

## Phase 25 — Sales Posting

Phase 25 owns accounting effects of confirmed Sales documents.

It must consume:

- revenue/tax/receivable facts from Sales;
- cost-of-goods-sold and inventory relief from Inventory Valuation for stock items.

The expected boundary is:

`Sales Invoice -> revenue / tax / receivable`

and independently:

`Inventory Issue -> FIFO/MWA valuation -> COGS / inventory relief`

Phase 25 joins these accounting effects without deriving COGS from selling price and without deriving selling price from inventory cost.

## Price list versus historical cost

Changing a Sales price list affects future commercial pricing according to the price-list effective dates. It never changes historical inventory valuation.

Changing a future Purchase price affects future Purchase transactions. It never changes old receipts.

Changing historical inbound cost is a correction operation, not a price-list update.

## Source precedence for Inventory Cost Input

For a confirmed inbound stock movement, the preferred cost-source precedence is:

1. linked authoritative Purchase source, when available;
2. another authoritative ERP/import source, when explicitly configured;
3. opening-balance authoritative cost;
4. manual exception resolution.

There must be at most one active authoritative Cost Input for a movement at a time. A new authoritative source does not silently overwrite an existing one; source replacement follows correction/reconciliation rules and Audit.

## UI guidance

Inventory Valuation should present manual price entry as exception handling, with wording such as `رفع بهای ورودی نامشخص`, not as the normal place to maintain purchase prices.

Registered Cost Inputs may remain visible in Inventory Valuation for review, provenance and controlled correction, but this surface is not a Purchase price list and is not a Sales pricing screen.

Purchase Workflow must be the normal screen for entering supplier unit price.

Sales Workflow must be the normal screen for selecting or overriding an authorized sales price.

## Tadbir/Mirza reference

The reviewed Tadbir/Mirza workflow follows the same general separation: Purchase entry captures quantity and unit value, purchase expenses and discounts at the Purchase document; purchase-price lists and sales-price lists are separate concepts; warehouse/inventory costing remains a separate concern.

ArginAccounting keeps that useful separation while using stronger bounded contexts, immutable movement identity, Audit, idempotency, deterministic valuation and future Argin Bridge synchronization.

## Argin Bridge boundary

Bridge synchronization preserves ownership:

- Purchase commercial documents/prices synchronize as Purchase facts;
- Sales price lists/invoices synchronize as Sales facts;
- Inventory Movements synchronize as Inventory quantity facts;
- resolved Cost Inputs synchronize as authoritative valuation inputs;
- FIFO layers, MWA state and monetary report projections are rebuildable derived state.

No module should synchronize a duplicated copy of another module's authoritative price as if it were independent truth.
