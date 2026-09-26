# Invoice-to-Goods-Receipt Workflow

## Purpose

Phase 23 Step 27 completes the desktop workflow that creates Inventory receipt drafts directly from a confirmed Supplier Invoice without re-entering supplier, product, unit or invoice quantities.

The workflow preserves ERP separation of concerns:

- Supplier Invoice remains the Purchase commercial source.
- Inventory receipt remains the physical stock document.
- Inventory remains the only authority that changes stock quantity.
- Purchase only prepares and stages receipt intent through the Inventory application boundary.

## User workflow

For a confirmed Supplier Invoice containing stock products, the Purchase workspace exposes:

- `Create goods receipt from invoice` when no active receipt exists.
- `Create receipt for remaining quantity` when one or more partial receipts already exist.

The receipt dialog is prefilled from authoritative Purchase facts. The user chooses only:

- destination warehouse;
- actual quantity received for each remaining stock line.

The UI shows, per stock line:

- invoiced base quantity;
- quantity already allocated to active linked receipts;
- remaining quantity;
- quantity for this receipt.

No supplier, product, purchase price, VAT, discount, charge, accounting account or Debit/Credit field is re-entered.

## Partial receipt policy

A Supplier Invoice may produce multiple Inventory receipts.

Example:

```text
Invoice quantity: 20

Receipt 1: 8
Receipt 2: 7
Receipt 3: 5

Remaining: 0
```

Active receipt allocations in `draft`, `submitted`, `approved` and `confirmed` states reserve invoice quantity for the purpose of creating additional receipt drafts. Cancelled and reversed receipts do not consume remaining quantity.

The desktop composition rejects a requested receipt quantity greater than the remaining source quantity.

Concurrency/race hardening across simultaneous users remains Step 31 scope.

## Persistence

The old Inventory schema enforced one Inventory document per source Purchase document through `uq_inventory_documents_source`.

Step 27 removes that uniqueness constraint and replaces it with a non-unique source lookup index. Durable Inventory document IDs and line-level Purchase source references remain authoritative.

Each receipt line continues to reference its exact Purchase line.

## Compatibility

`SqliteInventoryDocumentRepository.findBySource` remains available for older call sites, while `listBySource` is added for the new multi-receipt workflow.

The Purchase workspace keeps a compatibility `inventoryReceipt` pointer while exposing the canonical `inventoryReceipts` collection and per-line `receiptFulfillment` summary.

## Matching boundary

Step 27 does not redefine Purchase matching semantics. It only creates traceable Inventory receipt drafts and exposes fulfillment progress.

Step 28 owns the multi-receipt 2-way / 3-way matching engine and will consume the durable receipt/source-line links created here.

## Argin Bridge

Multiple receipt documents are independent durable Inventory facts. Bridge synchronization must preserve their individual IDs and Purchase source references. A UI aggregation such as "remaining quantity" is derived state and is not synchronization authority.
