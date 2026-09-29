# Purchase Tax Posting

## Status

Phase 23 Step 8.

Step 8 determines the accounting destination of Purchase VAT/tax already captured by Purchase. It never recalculates tax from a rate.

## Tax Policy

Step 8 introduces a minimal Company-scoped recoverability policy:

- `recoverable`
- `non-recoverable`

The policy is an explicit input contract. Persistence/configuration UI remains a later concern.

## Recoverable VAT

Recoverable Purchase VAT is:

```text
Input VAT Recoverable     Debit
```

It is excluded from normal Inventory cost and Purchase Expense principal.

This preserves the Phase 22 boundary where normal Purchase Cost Input excludes tax.

## Non-Recoverable VAT

For stock products:

```text
Non-recoverable VAT
        ↓
Inventory capitalizable cost adjustment
        ↓
Step 12 authoritative valuation integration
```

Step 8 does not mutate FIFO/MWA or create its own Inventory value.

For service/non-stock purchases:

```text
Purchase Expense          Debit
```

The tax amount increases expense because it cannot be recovered as Input VAT.

## Source Authority

Tax amount comes only from immutable Purchase facts:

```text
line.amounts.taxAmount
```

Step 8 does not recompute tax percentage or tax base.

The sum of tax components must exactly equal the document `totals.taxAmount`.

## Supplier Payable

Supplier payable remains the full Supplier Invoice `grandTotal`, already frozen by Step 7. Step 8 only decides where the tax part of that total is debited.

## Non-Scope

- Tax calculation/rate determination — Purchase-owned
- Charge treatment — Step 9
- Return tax reversal — Step 10
- Correction tax effects — Step 11
- Capitalizable stock-cost application / FIFO-MWA integration — Step 12
- Journal line construction — Step 13
- Tax policy persistence/UI — later persistence/application work
