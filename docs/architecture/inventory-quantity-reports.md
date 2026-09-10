# Inventory Quantity Kardex, Balances and Source Drill-down

## Status

Phase 20 Step 17 implementation record. Quantity reporting is implemented over confirmed Inventory movement facts and the rebuildable on-hand balance projection. Monetary valuation remains Phase 21.

## Reporting Boundary

The reporting contract lives in `@argin/inventory` and is implemented by `SqliteInventoryQuantityReportReader` in `@argin/inventory-tauri`.

The Desktop route is `/inventory/reports` and is permission-gated by `inventory.documents.view`.

## Dual Stock Balance Views

The Inventory workspace exposes two complementary balance views rather than forcing one table to answer both management and warehouse-operation questions.

### Product Summary

The default management view contains one row per Product and answers: **how much of this Product is available on-hand in the visible scope?**

Each row contains:

- Product code/title;
- exact total quantity in the Product base unit;
- count of Warehouses with a visible quantity;
- count of physical StockKeys represented by the total;
- expandable per-Warehouse breakdown.

Expanding a Product shows exact quantity for every visible Warehouse. `Show warehouse detail` switches to the operational view already filtered to that Product/Warehouse, from which an exact StockKey can open Kardex.

Product totals are not calculated with SQLite floating-point `SUM`. The reader loads bounded StockKey chunks and combines canonical decimal strings with `addInventoryStockQuantities`. Multiple Zone/Location balances inside one Warehouse are first aggregated to the Warehouse, then all visible Warehouses are aggregated to the Product total.

### Warehouse / Location Detail

The detailed view keeps the original operational table:

`Product + Warehouse + optional Zone + optional Location + exact base quantity`.

This view supports Product, Warehouse, Zone, Location and include-zero filters and can open Kardex for an exact StockKey.

`inventory_stock_balances` remains a rebuildable projection. Neither balance view turns it into an independent source of truth.

## Reporting Scope

A Full Access user can explicitly choose between:

- **Company** — all Company-wide and Branch-owned Warehouses in the company;
- **Active Branch** — the active Branch plus Company-wide Warehouses.

A non-Full-Access user cannot request Company scope. The UI labels its aggregate as the **visible scope total**, not the whole-company total.

A non-null Branch limits the reader to Company-wide Warehouses plus Warehouses owned by that Branch. The adapter rejects Kardex reads for a Branch-owned Warehouse outside the supplied Branch context. Source-document drill-down is also Branch guarded.

## Authoritative Kardex

Kardex reads `inventory_all_stock_movements`, not `inventory_stock_balances`.

Canonical chronology is:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`.

Arrival time, SQLite row position and movement identifier alone never define chronology. Backdated confirmation can therefore change historical running balances after its business date.

Each entry exposes signed immutable movement fact, incoming quantity, outgoing quantity, running quantity, readable document/line metadata and optional external source reference. UI drill-down resolves by durable `documentId + lineId` but presents business-facing document and line detail instead of requiring users to work with technical identifiers.

## Opening / In / Out / Closing Reconciliation

The reader calculates opening quantity before the current page, incoming/outgoing quantity on the current page and closing quantity after the current page.

Exact addition uses `addInventoryStockQuantities`; no SQL `REAL`, JavaScript `number`, or floating-point accumulator is used.

Opening reconstruction uses bounded keyset chunks of at most 500 movement facts. For a continuation page, the cursor identifies the last movement of the previous page and opening includes that fact because the next page starts strictly after it. Therefore:

`closing(page N) == opening(page N + 1)`.

## Cursor Semantics

The Kardex cursor is opaque outside Inventory and encodes the full deterministic chronology tuple. The detailed balance cursor uses the durable serialized StockKey. The Product summary uses a Product continuation key while all underlying StockKey aggregation remains bounded.

## User Interface

The workspace is Persian RTL. Business dates are displayed and filtered as Jalali dates while persistence remains Gregorian `YYYY-MM-DD`. Codes and quantity strings use explicit LTR isolation.

The Product summary is intentionally the first-level management view. The user can then expand Warehouses and descend to the existing Warehouse/Zone/Location table and exact Kardex, matching the familiar ERP flow of **stock status -> warehouse breakdown -> item movement** without copying legacy UI limitations.

The page explicitly explains that current balance is **On-hand quantity only**. Reservations, Available-to-Promise and other availability concepts are not implemented in Phase 20.

## Explicitly Deferred

Step 17 does not implement FIFO or moving-average valuation, unit cost, monetary balance/Rial totals, reservation/ATP quantities, Excel/CSV export, or print/PDF/preview.

Import/export/print/PDF belongs to Step 18. Valuation belongs to Phase 21.

## Focused Regression Coverage

Step 17 focused coverage includes:

- opening/in/out/closing reconciliation across cursor pages;
- exact large decimal strings without floating-point conversion;
- Branch denial for an out-of-scope Warehouse Kardex;
- exact Product total across multiple StockKeys and Warehouses;
- Branch-scoped Product aggregation;
- Desktop presence of both Product-summary and Warehouse/location views;
- Company-vs-Branch scope labeling and secured composition;
- source document/line drill-down and business Kardex columns.

Executable package/Desktop results must be recorded only after they are actually run.
