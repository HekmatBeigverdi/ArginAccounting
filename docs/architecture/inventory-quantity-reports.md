# Inventory Quantity Kardex, Balances and Source Drill-down

## Status

Phase 20 Step 17 implementation record. Quantity reporting is implemented over confirmed Inventory movement facts and the rebuildable on-hand balance projection. Monetary valuation remains Phase 21.

## Reporting Boundary

The reporting contract lives in `@argin/inventory` and is implemented by `SqliteInventoryQuantityReportReader` in `@argin/inventory-tauri`.

The Desktop route is `/inventory/reports` and is permission-gated by `inventory.documents.view`.

## Stock Balance View

The balance report reads `inventory_stock_balances` as a rebuildable projection and joins Product/Warehouse/Zone/Location only for display metadata. Durable StockKey identity remains:

`Company + Product + Warehouse + optional Zone + optional Location`.

Balance quantities remain canonical decimal strings. The report never converts quantity through JavaScript floating point.

Supported filters are Product, Warehouse, Zone, Location and include-zero. Results are cursor-bounded to at most 500 rows per reader request; the Desktop requests 100 rows.

## Branch Scope

A non-null active Branch limits the report to:

- company-wide Warehouses; and
- Warehouses owned by the same Branch.

The report adapter rejects Kardex reads for a Branch-owned Warehouse outside the supplied Branch context. Desktop composition additionally verifies that the selected Branch is one of the authenticated actor's Branches unless `system.full-access` is present.

Source-document drill-down is also Branch guarded. Full document details are returned only for Full Access, company-wide documents, or documents whose origin Branch matches the active Branch.

## Authoritative Kardex

Kardex reads `inventory_all_stock_movements`, not `inventory_stock_balances`.

Canonical chronology is:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`.

Arrival time, SQLite row position and movement identifier alone never define chronology. Backdated confirmation can therefore change historical running balances after its business date.

Each entry exposes:

- signed immutable movement fact;
- incoming quantity;
- outgoing quantity;
- running quantity;
- document and line durable identities;
- display document number/type;
- optional external source system/document/line reference.

## Opening / In / Out / Closing Reconciliation

The reader calculates:

- opening quantity before the current page;
- incoming quantity on the current page;
- outgoing quantity on the current page;
- closing quantity after the current page.

Exact addition uses `addInventoryStockQuantities`; no SQL `REAL`, JavaScript `number`, or floating-point accumulator is used.

Opening reconstruction is performed with bounded keyset chunks of at most 500 movement facts. For a continuation page, the cursor identifies the last movement of the previous page. Opening includes that cursor movement because the next page starts strictly after it. Therefore the invariant is:

`closing(page N) == opening(page N + 1)`.

## Cursor Semantics

The Kardex cursor is opaque outside Inventory and encodes the full deterministic chronology tuple. The balance cursor uses the durable serialized StockKey stored in the projection.

Continuation never treats `movementId` as business chronology.

## Source Drill-down

The Desktop quantity report resolves the clicked movement by durable `documentId + lineId`. The side panel displays the owning document and the exact affected line while keeping the durable identifiers visible. Display numbers/codes are not used as foreign identity.

## User Interface

The workspace is Persian RTL. Business dates are displayed and filtered as Jalali dates while persistence remains Gregorian `YYYY-MM-DD`. Codes, identifiers, quantity strings and chronology numbers use explicit LTR isolation.

The page explains that current balance is **On-hand quantity only**. Reservations, Available-to-Promise and other availability concepts are not implemented in Phase 20.

## Explicitly Deferred

Step 17 does not implement:

- FIFO or moving-average valuation;
- unit cost, monetary balance or Rial totals;
- reservation / ATP quantities;
- Excel/CSV export;
- print/PDF or preview.

Import/export/print/PDF belongs to Step 18. Valuation belongs to Phase 21.

## Focused Regression Coverage

Step 17 adds focused adapter tests for:

- opening/in/out/closing reconciliation across cursor pages;
- exact large decimal balance strings without floating-point conversion.

Desktop contract tests cover route/navigation permission, Branch-aware composition, chronology/on-hand explanations, exact LTR display and durable source drill-down. Executable package/Desktop results must be recorded only after they are actually run.
