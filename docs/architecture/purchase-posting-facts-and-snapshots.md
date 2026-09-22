# Purchase Posting Facts and Snapshots

## Status

Phase 23 Step 3.

This document defines immutable input facts captured by Purchase Posting from authoritative upstream modules. It does not classify which facts should post, resolve accounts, construct Journal Lines or persist Posting state.

## Principle

Purchase Posting never asks the operator to re-enter facts already owned by Purchase, Inventory or Inventory Valuation.

Instead it captures an immutable provenance snapshot:

```text
Phase 22 Purchase Commercial Fact
        +
Phase 20 Inventory Movement Identity
        +
Phase 21 Valuation Result (when applicable)
        ↓
PurchasePostingFactSnapshot
```

The snapshot is evidence of the exact upstream facts consumed by accounting. It is not a second editable commercial or valuation source of truth.

## Fact Root

`PurchasePostingFactSnapshot` captures:

- durable `factId`;
- Company / Branch / Fiscal Year / Fiscal Period scope;
- Purchase Document identity and Purchase aggregate version;
- Purchase document type and terminal source status;
- document number and business date;
- Supplier snapshot;
- immutable line snapshots;
- immutable document commercial totals;
- canonical UTC `capturedAt`.

The canonical Source Reference/Identity abstraction remains Step 4.

## Supplier Snapshot

The Supplier snapshot preserves the historical identity displayed/used when the accounting fact was captured:

- Company ID (for scope-integrity verification);
- Supplier ID;
- code;
- display name;
- national code / national ID;
- economic number;
- tax-file number.

It is historical provenance. Changes to current Party master data must not rewrite old Posting Facts.

## Line Snapshot

Each line preserves:

- Purchase line ID and stable position;
- `stock-product`, `non-stock-product` or `service`;
- Product/Service historical snapshot;
- canonical base quantity;
- already-calculated commercial amounts;
- zero or more authoritative Inventory Valuation snapshots.

No unit price, discount, tax or charge is entered again in Purchase Posting.

## Commercial Amount Snapshot

The accounting boundary captures the Phase 22 totals directly:

```text
grossAmount
discountAmount
netAfterDiscount
chargeAmount
taxBaseAmount
taxAmount
grandTotal
```

Step 3 validates only snapshot integrity:

```text
gross - discount = netAfterDiscount
netAfterDiscount + charge = taxBaseAmount
taxBaseAmount + tax = grandTotal
```

This is corruption detection, not repricing. The Purchase pricing engine remains the authority that originally calculated these values.

Document totals must equal the exact sum of captured line totals.

## Valuation Snapshot

A stock-product line may carry zero or more authoritative Phase 21 valuation snapshots because one Purchase line can be matched to multiple Inventory receipts/movements:

- Company ID;
- valuation entry ID;
- Inventory movement ID;
- Inventory document/line (receipt, issue or compensating movement source);
- Product and Warehouse;
- valuation policy ID;
- FIFO or Moving Weighted Average method;
- strategy version;
- valuation currency;
- valued quantity;
- unit cost;
- total cost.

Services and non-stock lines cannot carry Inventory valuation. Duplicate valuation-entry or Movement identity inside one Purchase line is rejected. Supplier and Valuation Company scope must match the Posting Fact Company.

Commercial currency and valuation currency are deliberately not forced to match in Step 3. Future accounting/FX policy may need both values, and Step 3 must preserve source facts rather than invent conversion policy.

## Purchase Order

Step 3 permits capturing a `purchase-order` fact.

This does **not** mean a Purchase Order creates accounting entries. Posting-event eligibility/classification remains Step 5, where Purchase Order is expected to classify as non-posting under the frozen Phase 23 baseline.

## Source Status

Step 3 accepts terminal source states relevant to immutable Purchase history:

- `confirmed`;
- `returned`;
- `corrected`.

Exact accounting event meaning is not inferred here. Step 5 owns event classification and Steps 7–11 own posting semantics.

## Argin Bridge

The Fact Snapshot is Bridge-compatible because all identities are durable and the payload is serializable.

Durable source identity plus request/operation/correlation/causation metadata are defined by Step 4. The final Bridge envelope, schema version, payload fingerprint and synchronization metadata remain Step 22.

The Bridge must treat these snapshots as immutable provenance, not editable copies of Purchase or Valuation master state.

## Non-Scope

Step 3 does not implement:

- source-reference contracts — Step 4;
- event classification/eligibility — Step 5;
- account mapping — Step 6;
- supplier invoice/VAT/charge/return/correction accounting formulas — Steps 7–11;
- live Inventory/Valuation readers — Step 12;
- Draft Journal generation — Step 13;
- SQLite persistence — Steps 20–21;
- Argin Bridge synchronization envelopes — Step 22.
