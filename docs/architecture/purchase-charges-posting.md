# Purchase Charges Posting

## Status

Phase 23 Step 9.

Step 9 determines the accounting destination of Purchase line charges already captured by Purchase. It does not invent landed-cost components and does not create Journal Lines.

## Existing Phase 22 Cost Boundary

For a stock Purchase line, Phase 22 defines the normal Purchase Cost Input as:

```text
taxBaseAmount = netAfterDiscount + chargeAmount
```

Therefore the normal line `chargeAmount` is already inside the authoritative Purchase Cost Input consumed by Inventory Valuation.

Step 9 must not debit that same charge a second time.

## Stock Product

For stock products:

```text
chargeAmount
   ↓
already included in Purchase Cost Input
   ↓
Inventory Valuation
   ↓
Inventory Asset
```

The component is marked:

- destination: `inventory-capitalizable-cost`
- account role: `inventory-asset`
- `includedInPurchaseCostInput = true`
- deferred to Step 12.

Step 12 consumes the authoritative valuation result; it does not add the charge again.

## Service / Non-Stock Product

For service and non-stock purchases there is no Inventory Cost Input. Their Purchase charge is:

```text
Purchase Charge Expense     Debit
```

through the `purchase-charge` account role.

## Control

The sum of all charge components must equal:

```text
fact.totals.chargeAmount
```

Zero-charge invoices generate no synthetic charge component.

## External Landed Cost

External freight/landed-cost facts that are not represented by the Purchase line `chargeAmount` are not invented in Step 9.

A future explicit landed-cost source/policy may feed the existing Inventory inbound-cost model, but it must preserve separate source identity and must not silently alter Purchase commercial facts.

## Non-Scope

- Tax posting — Step 8
- Purchase Return — Step 10
- Purchase Correction — Step 11
- Inventory Valuation / GRNI integration — Step 12
- Journal construction — Step 13
