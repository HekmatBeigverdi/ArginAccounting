# Supplier Invoice Posting Rules

## Status

Phase 23 Step 7.

Step 7 freezes Supplier Invoice posting semantics without creating Journal Lines.

## Frozen Baseline

A confirmed Supplier Invoice produces:

- Supplier payable: **credit** for Purchase commercial `grandTotal`.
- Stock product principal: **debit** to the Inventory role, but the amount basis is authoritative Inventory Valuation and remains deferred to Step 12.
- Non-stock product / Service principal: **debit** to Purchase Expense using Purchase `netAfterDiscount`.
- VAT component: preserved from Purchase facts and deferred to Step 8.
- Charge component: preserved from Purchase facts and deferred to Step 9.

## Why Stock Amount Is Deferred

Phase 23 must not treat supplier commercial price as authoritative Inventory value.

Therefore a stock line records:

```text
role = inventory-asset
side = debit
amountBasis = inventory-valuation
amount = null
deferredToStep = 12
```

Step 12 joins the authoritative Phase 21 valuation result.

## Commercial Control

Step 7 verifies the Purchase commercial identity:

```text
principal net-after-discount
+ charges
+ tax
= grand total
```

This is a control check only; Step 7 does not reprice the Purchase.

## GRNI

Step 7 keeps the baseline Inventory role for stock recognition. Exact Inventory-vs-GRNI timing/integration remains part of Step 12 because it depends on Inventory movement/valuation state and configured recognition timing.

## Non-Scope

- recoverable VAT policy — Step 8;
- Purchase charge capitalization/expense policy — Step 9;
- Purchase Return — Step 10;
- Purchase Correction — Step 11;
- Inventory/GRNI and authoritative valuation integration — Step 12;
- Journal construction/balance — Step 13.
