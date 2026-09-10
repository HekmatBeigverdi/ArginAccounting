# Phase 20 — SQLite, Migration and Desktop Integration Tests

## Purpose

Step 20 moves Phase 20 validation beyond Domain/Application fakes into real SQLite and the actual Desktop composition boundary. It does not replace Step 21 full-monorepo/performance/accessibility gates.

## Real SQLite coverage

`apps/desktop/src-tauri/tests/phase20_inventory_sqlite_integration.rs` opens actual SQLx SQLite connections and executes the same checked-in migrations used by Tauri.

The suite covers:

- upgrade from the Phase 19 schema boundary (migration 0025) through migrations 0026 and 0027 while preserving existing Company/Product/Warehouse master data;
- creation of the reversal compensation partition and unified `inventory_all_stock_movements` view;
- scoped document-number uniqueness and composite Company foreign-key isolation;
- append-only movement update/delete triggers;
- rollback of a failed transfer after its source fact has already been inserted inside one `BEGIN IMMEDIATE` transaction;
- successful transfer persistence as two base-quantity-conserving facts;
- one-time reversal compensation and visibility through the unified authoritative ledger;
- file-backed restart persistence for movement facts and durable idempotency keys.

`apps/desktop/src-tauri/tests/phase20_inventory_balance_rebuild.rs` deliberately corrupts the rebuildable balance projection, deletes it, reconstructs it from `inventory_all_stock_movements`, and verifies that authoritative movement history is unchanged. This proves the Phase 20 ownership rule that movements are authoritative while `inventory_stock_balances` is disposable/rebuildable state.

## Desktop composition coverage

`apps/desktop/tests/phase20-desktop-integration-contract.test.ts` verifies that the production Desktop composition exposes Inventory documents, reports and transfer center; uses the secured lifecycle composition; and connects import/export/print to the active Company/Fiscal context and permissions.

Warehouse master-data maintenance is now connected through the Phase 19 `WarehouseDependencyGuard` port. `InventoryWarehouseIntegrationProvider` registers `InventoryWarehouseDependencyGuard` before application routes render and unregisters it during provider cleanup. Explicit per-service dependency injection still has priority. This keeps Warehouse independent from Inventory while ensuring Desktop delete/deactivate/archive/move operations observe real Inventory stock, open-document and history dependencies.

`packages/warehouse/tests/warehouse-downstream-dependency-registration.test.ts` behaviorally verifies registration/delegation and cleanup of that port; it is not merely a source-text assertion.

## Boundaries

Step 20 does not introduce valuation, reservations, Purchase/Sales workflows, Bridge transport, or new migration semantics. Migrations 0026/0027 remain unchanged. No derived balance is promoted to synchronization authority.

## Required executable gates

Run from the repository root:

```bash
pnpm --filter @argin/inventory test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory-tauri test
pnpm --filter @argin/inventory-tauri typecheck
pnpm --filter @argin/warehouse test
pnpm --filter @argin/warehouse typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop build

cd apps/desktop/src-tauri
cargo test --test phase20_inventory_sqlite_integration
cargo test --test phase20_inventory_balance_rebuild
cargo check
```

The test definitions and production wiring are committed in Step 20. Successful execution must be recorded only from actual command output; repository inspection alone is not a pass result.
