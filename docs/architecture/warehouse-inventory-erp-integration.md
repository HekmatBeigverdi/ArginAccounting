# Warehouse Inventory and ERP Integration Boundaries

## Purpose

Phase 19 owns Warehouse Master Data and reusable reference contracts. It does not own stock state or transactional ERP workflows.

The dependency direction is forward-only:

`Warehouse Master Data -> future ERP consumers`

Warehouse must not import or mutate transactional models owned by Inventory, Purchases, Sales, Manufacturing, Cost Accounting, Accounting, Taxpayer, or synchronization infrastructure.

## Canonical durable references

Downstream records persist durable identity only:

- `warehouseId`
- optional `zoneId`
- optional `locationId`

`code`, `title`, Branch label, external identifier, and UI labels are mutable display/search metadata and must never replace these durable IDs as foreign identity.

A `locationId` reference requires the corresponding `zoneId`; the Warehouse contract exposes `createWarehouseOperationalReference(...)` to normalize this rule.

## Ownership matrix

| Context | Owns |
| --- | --- |
| Warehouse | Warehouse/Zone/Location definitions, lifecycle, organizational scope, physical hierarchy, eligibility/selectors, tombstone-compatible master-data deletion |
| Inventory | stock balances, quantities, stock movement, kardex, reservations, stock count |
| Inventory Valuation | cost layers, moving average/FIFO and inventory valuation |
| Purchases | purchase documents, goods receipts and purchase transactional prices |
| Sales | sales documents, dispatch documents and sales transactional prices |
| Transfer | inter/intra-warehouse transfer documents and transfer workflow state |
| Adjustment | inventory adjustment/count documents and adjustment workflow state |
| Manufacturing | material consumption, production output and WIP transactions |
| Cost Accounting | production cost and cost allocation |
| Accounting | posting rules, journal postings and inventory accounting entries |
| Taxpayer | projection, signing, submission and inquiry |
| Synchronization / Argin Bridge | outbox, transport, retry, acknowledgement and conflict resolution |

## Inventory boundary

Warehouse does not calculate or store available stock. Future Inventory modules reference Warehouse/Zone/Location by durable IDs and own all quantity-changing facts.

Warehouse deactivate/archive/delete and physical move/delete operations use `WarehouseDependencyGuard`. Inventory must later contribute concrete probes such as non-zero balance, open movement or reservation blockers without requiring a redesign of Warehouse Master Data.

## Purchase and sales boundary

Purchase/Sales documents may reference a Warehouse or physical Location for receiving/dispatch behavior, but document lifecycle, pricing, taxes and quantities remain inside their owning contexts.

Warehouse never infers stock or document state from purchasing/sales data directly. Those modules plug blockers into the dependency guard when they exist.

## Transfer and adjustment boundary

Transfer and Adjustment are transaction owners. They consume selectors/reference contracts from Phase 19 and must not mutate Warehouse Master Data as a side effect of posting a transaction.

A transfer between Warehouses is not the same operation as moving a Warehouse Location master record. `moveLocation(...)` only changes the physical master-data hierarchy and is separately guarded.

## Manufacturing and Cost Accounting boundary

Manufacturing can consume Warehouses classified for raw material, WIP or finished goods through selector policy, but classification remains Warehouse Master Data. Production issue/output and WIP quantity state belong to Manufacturing/Inventory.

Cost Accounting consumes movement/valuation outputs; it does not own Warehouse definitions.

## Accounting boundary

Accounting consumes inventory transaction/posting outputs. Warehouse itself does not generate Journal Vouchers and does not own account assignment or posting rules in Phase 19.

## Taxpayer boundary

Warehouse has no official 13-digit Taxpayer goods/service identity. Product/Service owns the official goods/service identifier and official Taxpayer unit mapping. Taxpayer projection/submission uses product/document data and must not place Taxpayer transport state on Warehouse.

## Branch and Company scope

Warehouse remains Company-scoped. A Warehouse is either company-wide or belongs to one Branch.

Future consumers must use the Step 15 selector contract:

- without Branch context: company-wide Warehouses only;
- with Branch context: the selected Branch plus company-wide Warehouses when allowed by policy.

Consumers must not bypass this rule by querying Warehouse tables directly.

## Argin Bridge boundary

Phase 19 already exposes Warehouse and physical-structure upsert/tombstone contracts. This phase does not implement network synchronization.

Future synchronization must preserve durable IDs and tombstone semantics without converting business lifecycle state (`inactive`/`archived`) into deletion.

## Dependency rules

- Warehouse may depend on shared platform contracts: Company, Security, Audit, Database/UoW, optimistic concurrency and synchronization metadata contracts.
- Future ERP contexts may depend on the public `@argin/warehouse` selector/reference/dependency contracts.
- `@argin/warehouse` must not depend on future transaction packages.
- Display metadata is never accepted as downstream identity.
- No consumer is allowed to write Warehouse SQLite tables directly; mutations go through Warehouse Application contracts.

## Phase 19 non-scope reaffirmed

This architecture contract does not implement stock balances, movements, receipts/issues/transfers, adjustments, valuation, pricing, accounting posting, manufacturing transactions, Taxpayer transport or live Argin Bridge synchronization.
