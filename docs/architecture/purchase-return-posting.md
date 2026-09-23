# Purchase Return Posting

## Status

Phase 23 Step 10.

Step 10 defines the accounting semantics of a confirmed Purchase Return as a new compensating accounting event. It never rewrites the original Supplier Invoice posting.

## Core Entry

A confirmed Purchase Return reduces the supplier liability:

```text
Accounts Payable            Debit
```

for the Purchase Return `grandTotal`.

The credit side depends on what is being returned.

## Stock Product

For stock products, Purchase Return creates an outbound compensating Inventory movement in Phase 22.

Therefore:

```text
Inventory Asset             Credit
```

must use the authoritative outbound valuation produced by FIFO/MWA.

Step 10 records:

```text
amountBasis = inventory-outbound-valuation
amount = null
deferredToStep = 12
```

It never credits Inventory using supplier price or rewrites the original inbound Cost Input.

Normal stock Purchase charges and non-recoverable tax that formed part of capitalized inventory cost are absorbed by that outbound valuation and are not credited a second time.

## Recoverable VAT

For recoverable VAT:

```text
Input VAT Recoverable       Credit
```

because the Purchase Return reduces the input-tax credit previously recognized.

## Non-Recoverable VAT

For stock items, non-recoverable VAT was capitalized through Inventory valuation and is therefore reversed through the outbound valuation.

For service/non-stock purchases, non-recoverable VAT had increased Purchase Expense and is reversed as:

```text
Purchase Expense            Credit
```

## Service / Non-Stock

Commercial principal:

```text
Purchase Expense            Credit
```

Purchase charge:

```text
Purchase Charge Expense     Credit
```

Recoverable VAT:

```text
Input VAT Recoverable       Credit
```

## Original Invoice Link

The posting plan preserves the durable ID of the original Supplier Invoice.

The Purchase Return document must be distinct from that original source. Step 10 consumes the authoritative compensation link; it does not infer the original invoice from dates, supplier, or amount.

## Immutability

```text
Original Supplier Invoice Posting
        remains unchanged

Purchase Return
        ↓
new compensating Posting
```

## Non-Scope

- FIFO/MWA calculation — Step 12
- Journal balancing/creation — Step 13
- atomic commit — Step 14
- replay/idempotency — Step 15
- Purchase Correction — Step 11
