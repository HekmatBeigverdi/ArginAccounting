# Inventory Negative Stock and Cost Resolution Policy

## Purpose

Phase 21 Step 10 defines how inventory valuation reacts when quantity is unavailable, cost basis is incomplete, or upstream valuation remains unresolved. The policy never invents cost and never silently converts unknown cost to zero.

## Default Policy

Version 1 defaults to:

- true negative stock: `block` valuation/confirmation;
- missing inbound cost basis: `defer` valuation;
- insufficient resolved cost basis while physical quantity exists: `defer` valuation;
- upstream unresolved cost: `defer` downstream valuation.

A future Application command may explicitly configure `negativeStockAction = defer` for a company that operationally allows negative stock. Even then, the monetary result stays unresolved until authoritative cost becomes available.

## Quantity vs Cost Availability

Step 10 distinguishes two different conditions:

1. **Negative stock** — requested outbound quantity is greater than physical quantity available at that chronology point.
2. **Insufficient cost basis** — physical quantity is sufficient, but resolved/costed quantity is lower than requested quantity.

The second condition is not treated as negative stock. It is deferred with reason `insufficient_cost_basis` so later cost resolution can trigger deterministic recalculation.

## Outcomes

The policy produces one of three outcomes:

- `resolved`: valuation may proceed normally;
- `blocked`: operation cannot proceed under the active valuation policy;
- `deferred`: quantity history may remain authoritative, but monetary valuation is recorded unresolved and must be recalculated after the missing dependency is resolved.

Deferred reasons are explicit:

- `negative_stock`
- `missing_inbound_cost`
- `upstream_cost_unresolved`
- `insufficient_cost_basis`

## Unresolved Valuation Entry

A deferred decision can be converted into the existing Phase 21 `InventoryValuationEntrySnapshot` unresolved form. Such an entry has:

- `costState = unresolved`;
- `unitCost = null`;
- `totalCost = null`;
- a stable unresolved reason;
- source movement identity and business chronology preserved.

No placeholder zero cost is emitted.

## Recalculation Relationship

Every deferred outcome sets `requiresRecalculation = true`. When the missing inbound cost, upstream cost or negative-stock dependency is later resolved, Step 9 recalculation starts from the earliest affected chronology point and deterministically rebuilds downstream monetary state.

## Argin Bridge

Bridge-compatible behavior requires the decision inputs and unresolved reason to be deterministic. Desktop SQLite and a future PostgreSQL/.NET server must reach the same result from the same physical quantity, resolved-cost quantity, policy version and source chronology.

Unresolved valuation is derived monetary state. Live transport, retry and distributed conflict handling remain Phase 45 scope.

## Deferred Scope

Step 10 does not implement persistence, Application commands, authorization, audit records, idempotency, transactions or UI. Those remain in Steps 11–17.
