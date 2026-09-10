# Inventory Documents Module

## Ownership

Phase 20 owns quantity documents and quantity stock effects. The bounded context is implemented by `@argin/inventory` for Domain/Application, `@argin/inventory-tauri` for SQLite/Desktop adapters, and the Desktop composition/UI under `apps/desktop`.

Inventory owns receipt, issue, opening, transfer and quantity-adjustment documents; controlled submit/approve/confirm/cancel/reverse lifecycle; immutable quantity movement facts; rebuildable on-hand projections; quantity Kardex; import/export/print integration; and public quantity-confirmation/movement-feed contracts.

## Dependencies

Inventory consumes public contracts from Company/Branch, Fiscal, Product/Unit, Warehouse, Security, Audit/Approval, Number Series and Database/UoW infrastructure. It does not write another module's tables directly.

Warehouse defines the downstream dependency-guard port. Desktop composition registers `InventoryWarehouseDependencyGuard`, preserving dependency direction while preventing destructive Warehouse/Zone/Location operations when stock, open documents or immutable history require protection.

## Public Contracts

- Durable `InventoryDocumentSnapshot`, line and source-reference identities.
- Exact decimal quantity and immutable historical unit snapshots.
- `InventoryApplicationService`, `InventoryDraftService` and `SecuredInventoryService`.
- `InventoryQuantityConfirmationPort` / source-document integration boundary for Purchase, Sales and Manufacturing.
- Ordered immutable movement feed for Phase 21 valuation.
- Versioned Argin Bridge document/movement envelopes with indivisible transfer/reversal semantics.
- Bounded quantity balance, Product summary and Kardex report contracts.

## Persistence

Migration `0026_inventory_documents.sql` creates documents, lines, lifecycle, primary movement facts, opening uniqueness facts, on-hand projection, business-order allocator and durable idempotency. Migration `0027_inventory_reversal_persistence.sql` adds append-only compensation facts and `inventory_all_stock_movements` as the authoritative logical ledger.

Movement and lifecycle history is append-only. `inventory_stock_balances` is a rebuildable projection and is never synchronized as an independent source of truth.

## Security

Inventory has separate permissions for view, create, edit, submit, approve, confirm, reverse, cancel, import and export. Company/Branch scope is enforced at the secured Application/report boundary. Shared Phase 8 Approval is required before confirmation; approval itself has no stock effect. Shared Audit records successful lifecycle activity with durable request/correlation identity.

## Desktop Experience

The Persian RTL workspace provides bounded document lists, Jalali input/display, LTR islands for codes/quantities, lifecycle actions and stale-version recovery. Quantity reports provide both Product-aggregate and Warehouse/Zone/Location views plus source-drillable Kardex. Import creates Drafts only. Excel and Print/PDF do not bypass lifecycle authorization.

## Quality Boundaries

- Quantity arithmetic never uses floating point.
- Stock-changing work executes inside one Inventory UoW and production SQLite uses a pinned `BEGIN IMMEDIATE` transaction.
- Same request identity replays durable outcomes instead of duplicating movement facts.
- Kardex chronology is `businessDate -> businessOrder -> documentId -> lineId -> movementId`.
- Report/list queries are bounded; large-history validation includes SQLite `EXPLAIN QUERY PLAN` gates.

## Deferred Scope

Phase 21 owns monetary valuation (FIFO/moving average/cost layers and valuation reports). Reservations/ATP, lot/serial/expiry, full stock-count sessions and two-stage in-transit logistics require later explicit phases. Live Argin Bridge transport/outbox/acknowledgement/conflict UI remains deferred to the synchronization phase.

## Canonical References

- [Phase 20 fixed plan](../phases/phase-20-inventory-documents-plan.md)
- [Inventory document architecture](../architecture/inventory-documents.md)
- [Inventory SQLite persistence](../architecture/inventory-sqlite-persistence.md)
- [Inventory quantity reports](../architecture/inventory-quantity-reports.md)
- [Inventory security, approval and audit](../security/inventory-security-approval-audit.md)
- [Inventory Argin Bridge contract](../architecture/inventory-argin-bridge-contract.md)
