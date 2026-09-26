# Purchase Matching Engine

## Purpose

Phase 23 Step 28 introduces a deterministic Purchase Matching Engine between confirmed Supplier Invoice facts, confirmed Inventory receipt facts, and an optional confirmed Purchase Order.

The engine is the accounting-eligibility control point for quantity/price agreement. It does not own Purchase pricing, Inventory quantity, Inventory Valuation, or Journal creation.

## Matching modes

### Two-way matching

When the Supplier Invoice is not linked to a Purchase Order, the engine evaluates:

```text
Supplier Invoice
      ↕
Confirmed Goods Receipts
```

The invoice becomes fully matched only when confirmed receipt coverage equals the invoice base quantity for every stock line.

### Three-way matching

When the Supplier Invoice and its lines carry durable Purchase source references to a confirmed Purchase Order, the engine evaluates:

```text
Purchase Order
      ↕
Supplier Invoice
      ↕
Confirmed Goods Receipts
```

The engine additionally compares:

- Product identity;
- ordered base quantity vs invoiced base quantity;
- order unit price vs invoice unit price.

## Step 28 tolerance baseline

The domain supports a price-tolerance value in basis points.

Step 28 freezes the desktop baseline at:

- exact quantity matching;
- `0` basis-point price tolerance by default.

A later Company Settings surface may provide a configured tolerance without changing the matching contract.

No variance is silently ignored.

## Multi-receipt behavior

One invoice line may be fulfilled by multiple confirmed receipt lines.

Example:

```text
Invoice: 20
Receipt 1: 8
Receipt 2: 7
Receipt 3: 5
Matched: 20
Remaining: 0
```

The engine reads already persisted immutable receipt/invoice match facts and proposes only the uncovered quantity.

Proposals are deterministic by invoice line and receipt identity.

## Durable match facts

Accepted matching proposals are persisted through the existing Purchase Application/Security boundary as `purchase_receipt_invoice_matches`.

The engine never edits an existing match in place.

Existing database invariants continue to protect:

- duplicate match IDs;
- duplicate invoice-line / receipt-line pairs;
- invoice over-matching;
- receipt over-matching;
- cross-company mismatches;
- cross-product mismatches.

## Matching status

Per invoice line and overall Purchase matching state use:

- `unmatched`;
- `partially-matched`;
- `matched`;
- `variance`.

`matched` means all required confirmed receipt quantity is covered and, in three-way mode, Purchase Order quantity/price checks are within policy.

`variance` blocks downstream accounting eligibility until reviewed/resolved by a future controlled variance workflow.

## Desktop workflow

The Purchase workspace displays a dedicated Matching section with:

- two-way vs three-way mode;
- invoice quantity;
- matched quantity;
- remaining quantity;
- PO quantity/price variance when applicable;
- overall matching status.

The authorized action **Match confirmed receipts** persists the current deterministic proposals.

The user does not re-enter receipt quantities, supplier prices, VAT, or accounting accounts in the matching action.

## Inventory valuation relationship

Once Purchase matching is complete, the existing valuation-cost resolution path can resolve cost inputs for all confirmed partial receipts associated with the invoice.

Step 28 extends that path to multiple confirmed receipts and requires each receipt line to be fully matched before its Purchase-derived valuation cost is accepted.

## Posting boundary

Matching completion is a prerequisite input for Step 29 — Automatic Purchase Posting Orchestrator.

Step 28 does not create Journal Vouchers.

## Argin Bridge

Match records remain independent durable facts with stable IDs and durable invoice/receipt line references.

Derived matching summaries and UI labels are rebuildable projections and are not Bridge synchronization authority.
