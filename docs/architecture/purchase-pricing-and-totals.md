# Purchase Pricing and Totals Engine

Phase 22 Step 7 defines deterministic Purchase pricing from the commercial facts introduced in Step 4.

## Line Calculation Order

For each Purchase line:

1. `grossAmount = enteredQuantity × unitPrice`, rounded to the currency minor unit with `half-away-from-zero`.
2. Discounts are applied in stored order. A percentage discount is calculated from the current amount after earlier discounts. A fixed discount subtracts its explicit money amount. A discount may never make the line negative.
3. `netAfterDiscount` is frozen after all discounts.
4. Charges are applied in stored order. A percentage charge is calculated from the current amount after earlier discounts/charges. A fixed charge adds its explicit money amount.
5. `taxBaseAmount = netAfterDiscount + charges`.
6. Tax is calculated from `taxBaseAmount` only when treatment is `taxable`; exempt/not-subject/unspecified produce zero tax amount.
7. `grandTotal = taxBaseAmount + taxAmount`.

All percentage rates remain integer basis points and all money remains safe integers in the currency's smallest unit. Decimal quantity multiplication uses integer/BigInt arithmetic and never binary floating point.

## Document Totals

Document totals are the exact sum of calculated line totals. All aggregated lines must use the same currency; mixed-currency aggregation is rejected. Empty-line aggregation returns zero totals and no operational side effect.

## Determinism and Argin Bridge

The calculation order, basis-point semantics and rounding policy are persistence-neutral. SQLite Desktop and future .NET/PostgreSQL implementations must reproduce the same line facts and totals. Bridge synchronization carries authoritative commercial inputs; calculated totals may be verified/rebuilt from those facts rather than becoming an independent pricing authority.

## Ownership Boundaries

Step 7 performs commercial arithmetic only. It does not match receipts/invoices (Step 8), create Inventory receipts (Step 9), create Inventory Valuation Cost Inputs (Step 10), perform accounting posting (Phase 23), or implement persistence/application orchestration (Steps 13–16).
