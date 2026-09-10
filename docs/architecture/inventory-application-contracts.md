# Inventory Application, Query and Repository Contracts

## Status

Phase 20 Step 9 defines the persistence-neutral Application boundary for Inventory Documents. It does not implement services, SQL, SQLite, Tauri commands, HTTP endpoints, durable transactions, concurrency control or idempotent replay.

## Contract Layers

### Commands

Inventory mutation commands carry durable Company/document identity, expected aggregate version where applicable, a stable request key and a canonical payload fingerprint. `businessOrder` is deliberately not caller-controlled: Step 10 obtains it from the UoW-scoped `InventoryBusinessOrderRepository` before invoking the stock workflows.

The command contracts cover draft creation/save/delete, lifecycle actions, confirmation and reversal. They do not authorize the operation by themselves.

### Bounded Queries

`InventoryQueryReader` is separate from mutation repositories and exposes only bounded read models:

- paged document list;
- document detail/by-number lookup;
- cursor-bounded quantity kardex;
- cursor-bounded stock balances.

Document pages are limited to 200 rows and cursor queries to 500 rows. Cursor values are opaque adapter-owned tokens. Every query includes Company identity; downstream authorization adds actor/Branch scope in the owning service/UI steps.

### Repositories

`InventoryDocumentRepository` stores the aggregate with optimistic expected-version updates. `InventoryMovementRepository` stores append-only movement facts and never exposes a balance mutation shortcut. `InventoryBalanceProjectionRepository` is explicitly a rebuildable cache/projection. Opening uniqueness, business-order allocation and idempotency each have separate ports so their durable constraints can be implemented atomically without coupling Domain to SQLite.

The repositories accept durable IDs/StockKeys only. Display numbers are lookup attributes, not foreign identity.

### Unit of Work

`InventoryUnitOfWork` groups documents, movements, balance projections, opening keys, business-order allocation and idempotency records under one persistence-neutral callback. Step 13 must make one callback a real SQLite transaction. Step 9 merely freezes the required composition surface.

The contract is intentionally strong enough for Step 10 to perform this order inside one UoW:

1. inspect prior idempotency outcome;
2. load/check document expected version;
3. resolve/validate current scope and masters;
4. allocate authoritative business order where stock-effective;
5. rebuild/check stock and generate all movement facts;
6. save lifecycle/document state and append movement batch;
7. replace affected balance projections and opening uniqueness facts;
8. persist idempotency outcome;
9. commit once.

The exact orchestration and concurrency behavior belongs to Step 10; actual SQLite atomicity belongs to Step 13.

## Typed Errors

`InventoryApplicationError` exposes a stable code and optional field. Defined categories cover invalid requests, missing records, optimistic concurrency, duplicate document numbers/movements/openings, stock conflict, idempotency conflict, authorization and dependency blocking. Adapters map storage/provider failures to these codes; consumers must not parse prose error messages.

## Future ERP Consumer Boundary

Future Purchase, Sales and Manufacturing modules receive two ports:

- `InventorySourceDocumentPort.stageDraft` to stage an Inventory-owned draft from durable external source identity;
- `InventoryQuantityConfirmationPort.confirm` to request the normal Inventory confirmation path.

External modules provide business intent, Product/unit quantities and Warehouse references. They cannot inject raw `InventoryStockMovementSnapshot` facts or mutable balance values. Approval, fiscal locks, master eligibility, negative-stock rules, optimistic concurrency and Inventory lifecycle remain authoritative inside Inventory.

This is an explicit Argin Bridge preparation rule as well: future synchronized consumers exchange durable source/document identities and requests, not database row IDs or independently editable stock balances.

## Deliberate Boundaries

- Step 9 contains no infrastructure imports in Domain/Application contracts other than public upstream DTO/reference types already owned by Product/Warehouse.
- No SQL, table names, migration numbers or SQLite implementation appears here.
- Query DTOs are not authorization grants.
- The idempotency repository is a port only; Step 10 defines replay/fingerprint behavior.
- The UoW is a port only; Step 13 defines transaction implementation and rollback semantics.
- Security/Audit/Approval composition remains Step 14.
- Stable movement feeds and concrete ERP dependency integration remain Step 15.
