# Inventory SQLite Persistence and Atomic Unit of Work

## Status

Phase 20 Step 13 implements the concrete SQLite persistence boundary for Inventory Documents. Domain/Application remain persistence-neutral; `@argin/inventory-tauri` owns SQLite repositories and the Unit of Work adapter.

## Transaction Guarantee

Inventory confirmation, transfer and reversal require true database atomicity. The earlier desktop database executor serialized transaction callbacks in JavaScript but did not pin commands to one SQLite connection, so it could not guarantee rollback.

Step 13 adds a production atomic bridge:

1. Rust obtains a `PoolConnection<Sqlite>` from the already loaded `tauri-plugin-sql` pool.
2. `BEGIN IMMEDIATE` executes on that pinned connection.
3. A transaction handle identifies the same connection for all callback reads and writes.
4. Success executes `COMMIT` on that connection.
5. Failure executes `ROLLBACK` on that connection.
6. The TypeScript executor still serializes transaction callbacks, which is conservative and prevents competing local Inventory writers from bypassing the stock revalidation window.

Direct-constructor test doubles retain the previous logical-session fallback; production connections created by `TauriSqliteExecutor.connect()` use the atomic bridge.

## Inventory Adapter Package

`@argin/inventory-tauri` implements:

- `SqliteInventoryDocumentRepository`
- `SqliteInventoryMovementRepository`
- `SqliteInventoryBalanceProjectionRepository`
- `SqliteInventoryOpeningBalanceRepository`
- `SqliteInventoryBusinessOrderRepository`
- `SqliteInventoryIdempotencyRepository`
- `SqliteInventoryUnitOfWork`

All repositories receive the transaction-bound `DatabaseSession` from one `DatabaseExecutor.transaction()` callback.

## Optimistic Concurrency

Document updates use compare-and-swap semantics:

`company_id + document_id + expectedVersion -> exactly one updated row`

A zero-row update is resolved to `inventory.application.concurrency-conflict` when the document still exists, otherwise `inventory.application.not-found`.

This document CAS is not the only stock protection. `BEGIN IMMEDIATE` plus the Step 10 authoritative movement reload means two different documents competing for the same StockKey cannot both validate against the same stale pre-commit ledger.

## Durable Idempotency

`inventory_idempotency` is read and written inside the same UoW as document lifecycle, movement facts, opening uniqueness and balance projection. Therefore a committed stock effect has its replay outcome committed with it. A failed transaction leaves neither the mutation nor a false completed idempotency record.

## Business Ordering

`SqliteInventoryBusinessOrderRepository.next()` uses one transaction-bound SQLite upsert with `RETURNING last_order`. `businessOrder` is therefore allocated after the write transaction has begun and cannot be injected by the caller.

## Reversal Persistence Correction

Step 12 identified that a reversal movement has two identities with different ownership semantics:

- `documentId` is the compensating/effect document identity (`reversalDocumentId`).
- `lineId` remains the durable source line identity of the original movement.

Migration `0026_inventory_documents.sql` originally required every movement line to belong to the same `document_id`, which is correct for ordinary confirmation/transfer facts but incompatible with the accepted reversal model.

Step 13 resolves this without changing Domain or Bridge identity:

- ordinary and transfer facts remain in `inventory_stock_movements`;
- migration `0027_inventory_reversal_persistence.sql` adds append-only `inventory_stock_movement_compensations` for reversal facts;
- compensation rows reference the original immutable movement and original durable line;
- `inventory_all_stock_movements` exposes both physical partitions as one authoritative ledger to repositories;
- one original movement can be compensated only once.

This is a physical persistence partition only. Consumers still see one `InventoryStockMovementSnapshot` contract and one movement ledger.

## Opening Persistence

The Application opening key intentionally contains only Company, fiscal year and StockKey uniqueness. The SQLite opening repository resolves trace metadata (`documentId`, `lineId`, `recordedAt`) from the newly appended opening movement inside the same transaction before inserting `inventory_opening_balances`.

## Balance Projection

`inventory_stock_balances` remains a cache/projection. Repository reads can reconstruct movement count and latest movement from `inventory_all_stock_movements`. The stored projection must never become an independent source of truth or a synchronized Bridge fact.

## Commit Ordering

The Step 10 service performs the logical sequence inside one Step 13 transaction:

1. read idempotency;
2. reload document and compare expected version;
3. transaction-bound scope/master validation;
4. read authoritative StockKey movement facts;
5. allocate business order;
6. evaluate stock workflow;
7. append immutable movement/compensation facts;
8. update balance projection;
9. add opening uniqueness facts when applicable;
10. CAS-update the document/lifecycle;
11. persist idempotency outcome;
12. commit once.

Any exception before step 12 rolls back all database writes.

## Boundary

Step 13 does not implement permissions, Audit or shared Approval composition (Step 14), master-data dependency guards (Step 15), Desktop UI (Step 16), or live Argin Bridge transport (Phase 45). It also does not introduce valuation/cost facts; those remain Phase 21.
