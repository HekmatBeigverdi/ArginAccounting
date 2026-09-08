# Inventory Master Data Dependency Guards and ERP Integration

## Status

Phase 20 Step 15 defines the concrete dependency boundary from Inventory back to Warehouse maintenance and the public forward-only ERP integration surface from Purchase, Sales, Manufacturing and Phase 21 valuation into Inventory.

## Ownership Direction

Warehouse owns Warehouse/Zone/Location master definitions. Product owns Product and unit master data. Inventory owns quantity documents, immutable movement facts, stock balances as rebuildable projections, quantity Kardex and confirmation rules.

Downstream ERP modules may request Inventory work through public ports. They must never write Inventory tables, append StockMovement facts directly, or treat `inventory_stock_balances` as authoritative.

## Warehouse Dependency Guard

`InventoryWarehouseDependencyGuard` is structurally compatible with the Phase 19 `WarehouseDependencyGuard` contract without introducing a reverse package dependency from Inventory infrastructure to Warehouse infrastructure.

It evaluates three dependency classes:

- non-zero Inventory stock rebuilt exactly from authoritative `inventory_all_stock_movements` quantity deltas;
- open Inventory documents (`draft`, `submitted`, `approved`) referencing the Warehouse/Zone/Location on source or destination operations;
- immutable historical movement facts from `inventory_all_stock_movements`.

Protected-operation policy:

| Operation | Non-zero stock | Open document | Historical movement |
| --- | --- | --- | --- |
| Warehouse delete | Block | Block | Block |
| Warehouse deactivate/archive | Block | Block | Preserve/allow history |
| Zone delete | Block | Block | Block |
| Zone deactivate | Block | Block | Preserve/allow history |
| Location delete | Block | Block | Block |
| Location deactivate | Block | Block | Preserve/allow history |
| Location move | Block | Block | Block |

Historical references block destructive delete because removal would break immutable accounting/Inventory history. Deactivation/archive do not erase identity, so historical use alone does not block them. Location movement is blocked by history because changing its Zone relationship would reinterpret historical StockKeys.

The guard is Company-scoped and uses durable IDs only. Warehouse code/title or UI path labels are never dependency identity. Exact stock aggregation uses Inventory decimal arithmetic rather than SQLite `REAL` or JavaScript floating point.

## Product and Unit History

Inventory line facts already snapshot:

- entered quantity;
- base quantity;
- entered unit durable ID and snapshot metadata;
- base unit durable ID and snapshot metadata;
- conversion factor used at the time of the operation.

Later Product or unit-master edits must not rewrite confirmed Inventory history. Current Product eligibility and current unit conversion rules are revalidated when staging/confirming new work, while historical line snapshots remain immutable evidence of the original transaction.

## ERP Confirmation Port

`InventoryQuantityConfirmationPort` is the public confirmation boundary for future Purchase/Sales/Manufacturing modules.

`SecuredInventoryQuantityConfirmationPort` routes that request through `SecuredInventoryService.confirm()`. This intentionally preserves:

1. Company/Branch authorization;
2. shared Phase 8 Approval requirement;
3. optimistic document version checks;
4. authoritative movement reload and stock validation;
5. atomic SQLite Unit of Work;
6. durable idempotency and replay handling;
7. successful Audit semantics.

Future ERP modules therefore ask Inventory to confirm; they do not create stock effects themselves.

`InventorySourceDocumentPort` remains the staging contract for future source-owned commercial/manufacturing workflows. A concrete Purchase/Sales/Manufacturing staging adapter belongs to the owning future phase because those modules do not yet exist and their source lifecycle cannot be invented in Phase 20.

## Movement Feed

`InventoryMovementFeedReader` exposes immutable movement facts for Phase 21 valuation and later ERP consumers. The SQLite implementation reads `inventory_all_stock_movements`, which combines ordinary/transfer facts and reversal compensation facts into one logical authoritative ledger.

Feed ordering is deterministic:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`

The feed is Company-scoped and bounded to at most 500 items per request. Continuation uses the previous movement identity to resolve its full chronology tuple; movement ID itself is not treated as sortable chronology.

Consumers receive durable document/line/transfer/reversal identities, exact decimal `quantityDelta`, Warehouse operational references and timestamps. They do not receive an independently authoritative balance value.

## Phase 21 Boundary

Inventory Valuation consumes the movement feed and may create cost layers/value calculations linked to movement IDs. Phase 21 must not update/delete Phase 20 movement facts or reinterpret historical unit quantities.

## Deferred

This step does not implement Purchase/Sales/Manufacturing documents, valuation, reservation/ATP, UI, live Argin Bridge transport or cross-module database writes. Desktop wiring of the concrete guard into the Warehouse composition root is validated together with cross-module Desktop integration in Step 20.
