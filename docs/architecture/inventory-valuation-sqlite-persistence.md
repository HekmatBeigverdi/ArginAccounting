# Inventory Valuation SQLite Persistence

Phase 21 Step 12 persists the valuation contracts defined in Step 11 without changing the Phase 20 quantity authority boundary.

## Migration

Desktop migration `0028_inventory_valuation.sql` is registered as migration version 28 in `apps/desktop/src-tauri/src/lib.rs`.

It creates:

- `inventory_valuation_policies` — append-only authoritative Company valuation-policy history.
- `inventory_valuation_cost_inputs` — resolved monetary input snapshots keyed by durable movement identity.
- `inventory_valuation_entries` — rebuildable monetary valuation facts/results per movement.
- `inventory_valuation_cost_layers` — rebuildable FIFO layer projection.
- `inventory_valuation_states` — rebuildable Product/Warehouse/Location/date valuation-state projection.

Phase 20 `inventory_all_stock_movements` remains the authoritative quantity movement source and is not duplicated.

## Identity and scope

Persistence never uses SQLite row identity as a business identity. Policy, movement, valuation-entry, layer and basis-line identities are durable text IDs suitable for Desktop/Server replay and future Argin Bridge synchronization.

Company scope is explicit on every valuation table. Product and Warehouse identities are retained on derived valuation rows so deterministic Product-wide recalculation can cross Warehouse boundaries after transfers.

## Policy history

`inventory_valuation_policies` enforces:

- unique `policy_id`;
- unique `(company_id, effective_from)`;
- unique `(company_id, revision)`;
- predecessor reference through `previous_policy_id`;
- append-only behavior through no-update/no-delete triggers.

The Domain still owns semantic transition validation. SQLite provides structural defense in depth.

## Cost inputs

`inventory_valuation_cost_inputs` stores a resolved inbound cost-basis snapshot. It does not own Purchase, Vendor, freight, customs or Treasury workflow. Those modules/adapters remain responsible for producing authoritative cost inputs through the Step 11 boundary.

Unknown cost is never stored as zero. An unresolved valuation is represented in `inventory_valuation_entries` with `unit_cost` and `total_cost` both null and a non-null `unresolved_reason`.

## Derived valuation entries

`inventory_valuation_entries` enforces resolved/unresolved consistency with a table CHECK constraint and indexes canonical recalculation/report paths:

`company_id -> product_id -> business_date -> business_order -> document_id -> line_id -> movement_id`.

Partial indexes support transfer and reversal traceability, and a dedicated unresolved index supports diagnostic queries.

## FIFO layers

`inventory_valuation_cost_layers` only accepts `method = 'fifo'`. A layer references its source valuation entry. The foreign key uses `ON DELETE CASCADE` because both the entry and its FIFO layers are derived state: deleting downstream entries during deterministic recalculation must remove their derived layers without touching authoritative quantity movements or policy history.

## Valuation state

`inventory_valuation_states` is a dated projection keyed by Company, Product, Warehouse, canonicalized Zone/Location keys and business date. Null Zone/Location values are represented as empty key components only in the persistence key; Application/Domain contracts continue to expose null.

## Repository adapters

`packages/inventory-tauri/src/sqlite-inventory-valuation-repositories.ts` implements:

- `InventoryValuationPolicyRepository`;
- `InventoryValuationEntryRepository`;
- `InventoryCostLayerRepository`;
- `InventoryValuationStateRepository`;
- `InventoryValuationCostInputProvider`;
- `InventoryValuationMovementReader`.

Movement reads are served from the existing Phase 20 `inventory_all_stock_movements` view and preserve canonical ordering.

## Recalculation replacement boundary

Repository contracts expose downstream replacement operations. Step 12 defines the SQL mutations, but does not claim transaction atomicity across repositories. Step 13 owns the transaction boundary, idempotency and optimistic-concurrency behavior required to make multi-repository replacement all-or-nothing.

## Argin Bridge

Bridge rules remain:

- synchronize authoritative policy history and authoritative cost-input facts by durable ID/revision;
- do not synchronize SQLite row identities;
- treat valuation entries, layers and state projections as deterministically rebuildable outputs;
- identical movement facts, policy history, cost inputs and algorithm versions must derive identical monetary valuation on SQLite Desktop and future PostgreSQL/.NET Server.

Live transport, acknowledgements, retry and distributed conflict handling remain Phase 45 scope.
