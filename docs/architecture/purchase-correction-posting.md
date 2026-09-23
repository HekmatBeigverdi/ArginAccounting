# Purchase Correction Posting

## Status

Phase 23 Step 11.

Step 11 converts a confirmed Purchase Correction into accounting deltas by comparing the immutable original Supplier Invoice Fact with the immutable corrected Purchase Fact.

## No Manual Delta Entry

The posting layer does not ask the user or UI to re-enter correction deltas.

```text
Original Supplier Invoice Fact
          +
Confirmed Purchase Correction Fact
          ↓
deterministic delta
```

Line linkage identifies which original Purchase line each correction line replaces/adjusts.

## Supported Correction Effects

- `commercial-replacement`
- `quantity-decrease`
- `quantity-increase`

These effect labels come from the Phase 22 correction workflow and are preserved in the posting plan.

## Supplier Payable

The document-level payable delta is:

```text
corrected grandTotal - original grandTotal
```

If positive:

```text
Accounts Payable       Credit
```

If negative:

```text
Accounts Payable       Debit
```

Only the absolute delta is posted.

## Service / Non-Stock

For service/non-stock lines, commercial deltas are directly recognized:

- principal delta → `purchase-expense`
- charge delta → `purchase-charge`
- recoverable VAT delta → `input-vat-recoverable`
- non-recoverable VAT delta → `purchase-expense`

Positive delta = Debit; negative delta = Credit.

## Stock Product

Stock corrections do not directly derive an Inventory amount from Purchase price.

Any stock correction affecting:

- principal cost;
- line charge;
- non-recoverable VAT;
- quantity increase/decrease;

creates an `inventory-valuation-delta` component deferred to Step 12.

Step 12 resolves the authoritative valuation effect after the Phase 22 Cost Input replacement / compensating Inventory movement has been processed.

Recoverable VAT remains separate and posts by commercial delta.

## Immutability

The original Supplier Invoice, original Inventory movements and original Journal posting are not edited.

```text
Original facts remain immutable
          ↓
Purchase Correction
          ↓
new accounting delta
```

## Source Integrity

Step 11 requires:

- same Company;
- same Branch;
- same Supplier;
- same Currency;
- explicit original Supplier Invoice ID;
- unique original/correction line links;
- matching Product/Service identity and line kind.

## Non-Scope

- valuation replay/calculation — Step 12
- Journal construction/balance — Step 13
- atomic posting — Step 14
- replay/idempotency — Step 15
