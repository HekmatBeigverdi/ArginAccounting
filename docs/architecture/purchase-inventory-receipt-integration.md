# Purchase Inventory Receipt Integration

Phase 22 Step 9 connects confirmed Purchase stock intent to the Inventory source-document boundary without transferring Inventory ownership to Purchase.

## Ownership

Purchase owns supplier commercial facts and durable Purchase source identity. Inventory remains authoritative for receipt documents, Warehouse eligibility, Inventory lifecycle, approval/confirmation, stock movements, balances and reversals.

Purchase therefore does **not** create `InventoryStockMovement` facts directly. It stages an Inventory-owned `receipt` draft through an `InventorySourceDocumentPort`-compatible boundary.

## Eligible Purchase Sources

A receipt draft may be staged only from a `confirmed` Purchase document of type:

- `purchase-order`; or
- `supplier-invoice`.

`purchase-return`, `purchase-correction`, non-confirmed Purchase documents, service lines and non-stock Product lines are not receipt sources in Step 9.

Purchase return/correction stock compensation remains Step 12.

## Stock Line Mapping

Every staged Inventory receipt line keeps the Purchase line durable identity as `sourceLineId` and maps:

- Purchase `itemId` -> Inventory `productId`;
- requested Purchase base quantity -> Inventory `enteredQuantity`;
- captured Purchase base-unit ID -> Inventory `unitId`;
- Purchase receipt allocation Warehouse reference -> Inventory Warehouse reference.

The adapter intentionally uses the Purchase line's **base unit**. This avoids unit ambiguity between commercial entry units and Inventory quantity facts.

A single Step 9 receipt request may include each Purchase source line at most once. The staged quantity must be positive and must not exceed that Purchase line's captured commercial base quantity for that request.

Cumulative partial-receipt availability across persisted receipts belongs to later Application/Repository orchestration; Step 9 does not invent persistence state.

## Commercial Fact Boundary

The current Purchase aggregate does not yet persist `PurchaseCommercialTerms` directly on `PurchaseDocumentLineSnapshot`. Step 9 therefore receives immutable commercial facts keyed by durable `purchaseLineId` and uses them only to obtain the authoritative captured base quantity and base unit.

This is not a second price/quantity entry path. Application contracts and persistence in Steps 13–16 must resolve these facts from Purchase-owned state rather than ask the operator to re-enter commercial quantity.

## Inventory Port Compatibility

`PurchaseInventoryReceiptStageRequest` and `PurchaseInventoryReceiptPort` are structurally compatible with Inventory's existing `StageInventorySourceDocumentRequest` and `InventorySourceDocumentPort` contracts.

The Purchase package does not take a runtime dependency on Inventory in Step 9. The formal Application dependency/adaptation is completed in Step 13/14.

The staged request contains:

- `companyId`;
- durable `inventoryDocumentId`;
- `documentType = receipt`;
- Purchase business date;
- `sourceSystem = purchase`;
- Purchase document type and ID;
- Purchase source line IDs;
- Product, quantity, base unit and Warehouse intent;
- caller-supplied `requestKey` and `payloadFingerprint`.

Step 17 owns final idempotency and optimistic-concurrency semantics for these identities.

## Lifecycle Boundary

`stagePurchaseInventoryReceipt` calls `stageDraft` only. It does not auto-confirm the Inventory document and cannot bypass Inventory authorization, approval, Fiscal locks, Product/Warehouse validation or stock rules.

Only normal Inventory confirmation may later create stock movements.

## Argin Bridge

The Purchase-to-Inventory handoff preserves durable source identity and canonical decimal quantity. Bridge synchronization should replicate authoritative Purchase and Inventory facts separately. Derived links/projections may be rebuilt from durable IDs; replay must not create duplicate receipt effects.

## Non-Scope

- Inventory Valuation Cost Input integration: Step 10.
- Receipt-before-invoice and unresolved-cost policy: Step 11.
- Purchase return/correction stock compensation: Step 12.
- Application/repository/UoW orchestration: Steps 13–16.
- Full idempotency/concurrency: Step 17.
- Accounting posting: Phase 23.
