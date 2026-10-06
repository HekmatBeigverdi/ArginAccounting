# Phase 24 -> Phase 25 Sales Fulfillment and Posting Handoff

## Purpose

This document is the canonical handoff contract between Phase 24 Sales Workflow and Phase 25 Sales Posting. It prevents Sales commercial finalization, Inventory fulfillment and Accounting posting from being collapsed into one ownership boundary.

## Canonical stock-sale flow

```text
Sales Order (optional)
        |
        v
Sales Invoice
        |
        v
Sales Invoice Finalized
        |
        v
Inventory Issue Draft is staged automatically
        |
        v
Inventory Issue approval/finalization
        |
        v
Inventory Movement is confirmed
        |
        v
On-hand quantity decreases
        |
        v
Phase 21 FIFO/MWA valuation resolves outbound cost
        |
        v
Phase 25 Sales Posting
        |
        +--> A/R + Revenue + Output VAT
        |
        +--> COGS + Inventory Relief
        |
        v
Journal Voucher / immutable posting lineage
```

## Mandatory invariants

1. Finalizing a stock Sales Invoice MUST NOT directly update stock balances.
2. Finalizing a stock Sales Invoice MUST stage the related Inventory Issue through the Inventory public application contract. The issue starts as an Inventory-owned document; Sales must not write Inventory tables.
3. Stock quantity decreases only when the Inventory Issue reaches the Inventory confirmation/finalization point that creates the authoritative Inventory Movement.
4. Selling price, discounts, charges, VAT and receivable facts come from immutable Sales commercial snapshots.
5. Inventory cost and COGS come only from the resolved Phase 21 outbound valuation (FIFO/MWA). Selling price MUST NOT be used as cost.
6. For stock products, COGS/Inventory Relief posting MUST be blocked while the related Inventory Issue is not finalized/confirmed, the movement does not exist, or valuation is unresolved.
7. Phase 25 must preserve independent provenance for the commercial posting leg and inventory-cost posting leg even if they converge into one accounting voucher.
8. Retry/replay MUST NOT create a second Inventory Issue, second stock movement, second valuation effect or second Journal Voucher.
9. A service/non-stock line does not require Inventory Issue/valuation solely because it is sold; its commercial posting may proceed under Phase 25 rules.
10. Corrections/reversals MUST create explicit lineage. Finalized historical Sales, Inventory and Journal facts are not mutated in place.
11. CR-24-01 below-cost policy is a commercial gate only. An allowed/approved negative-margin sale remains valid; Phase 25 MUST post its real valuation-derived COGS and MUST NOT replace cost with selling price.
12. Posting trace should correlate the Sales policy/approval decision and its pre-finalization cost-quote basis with the authoritative valuation entry/revision actually consumed for COGS.
13. A Phase 24 cost quote is advisory/guard data only. It MUST NOT become the Phase 25 COGS source; the actual confirmed Issue and resolved FIFO/MWA valuation remain authoritative.

## Sales return flow

```text
Sales Return Finalized
        |
        v
Inventory Receipt Draft is staged automatically (stock lines)
        |
        v
Inventory Receipt confirmation/finalization
        |
        v
Inventory Movement is confirmed
        |
        v
On-hand quantity increases
        |
        v
Inventory Valuation resolves the return cost effect
        |
        v
Phase 25 return posting
        |
        +--> Sales Return / Revenue Contra + Output VAT reversal + A/R effect
        |
        +--> Inventory restoration + COGS reversal/adjustment
```

The cost side of a Sales Return must follow Inventory valuation lineage; it must never be derived from the returned selling price.

## Phase ownership

| Concern | Authority |
| --- | --- |
| Customer, selling price, discount, charge, output tax commercial fact | Phase 24 Sales |
| Inventory Issue / Receipt document lifecycle | Phase 20 Inventory |
| Stock movement and quantity | Phase 20 Inventory |
| FIFO/MWA and outbound/return cost | Phase 21 Inventory Valuation |
| Revenue / VAT / receivable posting | Phase 25 Sales Posting |
| COGS / Inventory Relief posting | Phase 25 Sales Posting consuming Phase 21 |
| Journal lifecycle and immutable accounting history | Accounting |
| Payment/settlement | Treasury phases |

## Phase 25 mandatory acceptance scenarios

Phase 25 is not complete until automated/E2E evidence covers at least:

- finalized stock invoice -> exactly one Inventory Issue Draft;
- invoice finalization alone does not decrease stock;
- Inventory Issue finalization -> exactly one movement and expected quantity decrease;
- resolved FIFO/MWA valuation -> cost fact independent from selling price;
- posting before required stock fulfillment/valuation is rejected;
- posting after fulfillment/valuation creates balanced revenue/VAT/receivable and COGS/inventory effects;
- exact replay creates no duplicate issue, movement or journal;
- partial/multiple stock lines retain line-level lineage;
- service-only invoice posts without Inventory fulfillment;
- mixed stock + service invoice waits only for stock-line fulfillment/cost prerequisites;
- finalized Sales Return -> exactly one Inventory Receipt Draft;
- return receipt finalization increases stock and return posting uses valuation cost lineage;
- correction/reversal preserves immutable historical lineage.
