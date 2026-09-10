# Phase 20 — Inventory Documents — Release Notes

## Release

- Version: `0.20.0`
- Tag: `v0.20.0`
- Title: `ArginAccounting v0.20.0 — Inventory Documents`

## Highlights

Phase 20 introduces the complete quantity-inventory document foundation for ArginAccounting.

### Inventory Documents

- Receipt, issue, opening, transfer and quantity-adjustment document types.
- Stable document and line identities with Company/Branch/fiscal scope.
- Draft, submitted, approved, confirmed, cancelled and reversed lifecycle states.
- Shared Approval integration with confirmation kept as a separate authority.
- Linked reversal with append-only compensating movement facts.

### Exact Quantity and Units

- Exact decimal-string quantity semantics without floating-point inventory arithmetic.
- Entered/base quantity and Product unit-conversion snapshots preserved historically.
- Durable Product/Warehouse/Zone/Location references instead of mutable display codes.

### Stock Ledger and Balances

- Append-only stock movement ledger.
- `inventory_all_stock_movements` as the authoritative logical quantity history.
- Rebuildable `inventory_stock_balances` projection.
- Deterministic business chronology using business date, business order, document, line and movement identity.
- Default rejection of historical negative running stock, including backdated effects.

### Transfers and Adjustments

- Atomic source/destination transfer effects with base-quantity conservation.
- Intra- and inter-Warehouse transfer support within the allowed Company/Branch policy.
- Reason-required signed quantity adjustments.
- Failure rollback leaves no partial transfer or stock effect.

### Desktop Workspace

- Persian RTL Inventory Document workspace.
- Solar Hijri date input/display with Gregorian durable storage.
- Explicit LTR isolation for document numbers, codes and exact quantities.
- Product, unit, Warehouse, Zone and Location selectors.
- Permission-aware lifecycle actions, Approval/history and stale-version recovery.

### Inventory Reports

- Aggregate Product inventory view across the visible scope.
- Warehouse/Zone/Location breakdown.
- Quantity Kardex with opening, in, out, running and closing quantities.
- Page-to-page reconciliation using deterministic cursors.
- Source drill-down from movement to durable document and line identity.
- On-hand quantity remains distinct from future reservation/Available-to-Promise concepts.

### Import, Export and Print

- XLSX/CSV Draft import with preview and validation before persistence.
- Retry-safe deterministic import identity.
- Import never submits, approves or confirms automatically.
- Excel export for Inventory documents and quantity reports.
- Full-screen Persian RTL print preview and Print/Save-PDF output with consistent orientation.

### SQLite and Concurrency

- Migrations `0026_inventory_documents.sql` and `0027_inventory_reversal_persistence.sql`.
- Production pinned SQLx SQLite transaction using `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`.
- Durable idempotency across restart.
- Optimistic document concurrency and transaction-scoped StockKey validation.
- Real SQLite migration/constraint/rollback/restart/balance-rebuild integration coverage.

### Master Data and ERP Integration

- Inventory-backed Warehouse/Zone/Location dependency guards.
- Delete/move/deactivate/archive decisions respect nonzero stock, open documents and immutable history as appropriate.
- Public secured quantity-confirmation contract for future Purchase/Sales/Manufacturing modules.
- Stable movement feed for Phase 21 Inventory Valuation.

### Argin Bridge

- Persistence-neutral document and movement change contracts.
- Durable IDs remain valid across SQLite, future .NET/PostgreSQL storage and synchronization.
- Transfer/reversal groups cannot be safely reduced to last-write-wins facts.
- Derived balance projections are not synchronized as independent authoritative stock values.

### Quality

- Domain/Application regression matrix.
- Real SQLite/Desktop integration coverage.
- Representative 20,000-movement performance/query-plan test.
- Accessibility, RTL, exact-decimal and bounded-query regression contracts.
- Unified `pnpm validate:phase20` release-quality gate.

## Intentionally Deferred

The release does not include Inventory Valuation, FIFO/moving average, cost layers, landed cost, reservations/ATP, full stock counts, lot/serial/expiry tracking, two-stage in-transit transfers, commercial Purchase/Sales ownership, accounting posting, or live Argin Bridge transport. These remain in their owning future phases.

## Next Phase

Phase 21 — Inventory Valuation consumes the immutable Phase 20 movement ledger and must not rewrite quantity history.

## Publication

The Phase 20 branch is promoted through `develop` and `main` during Step 22. Creation of semantic tag `v0.20.0` and the GitHub Release is performed manually by the repository owner.