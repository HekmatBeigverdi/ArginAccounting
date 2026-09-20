# Inventory Valuation Query Engine and Reports

Phase 21 Step 16 exposes bounded monetary reporting over the deterministic valuation projections created in Steps 2–13. Reporting is read-only: it never mutates quantity facts, valuation policy, cost inputs, cost layers, or stream revisions.

## Public Contract

`@argin/inventory/valuation-reports` defines `InventoryValuationReportReader` with five report families:

1. As-of inventory value.
2. Monetary Kardex.
3. Current FIFO layer detail.
4. Unresolved valuation diagnostics.
5. Recalculation/currentness status.

The Desktop adapter is `SqliteInventoryValuationReportReader` in `@argin/inventory-tauri`.

## Bounded Reads

Every row-producing query requires an explicit `limit`; the Phase 21 maximum is 500 rows. Monetary Kardex uses a canonical chronology cursor based on:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`.

As-of, layer, and unresolved reports expose `truncated` when the requested bound was reached. Step 19 owns representative-scale query-plan/performance validation.

## As-of Value

As-of value reads `inventory_valuation_states` and selects the latest persisted state for each Product/Warehouse/Zone/Location stock key whose `business_date <= asOfBusinessDate`.

Each row exposes:

- Company-filtered Product and Warehouse identity,
- optional Zone/Location,
- effective policy identity,
- method and strategy version,
- currency,
- exact quantity string,
- integer monetary value or `null`,
- unresolved count.

The report also exposes the sum of resolved integer monetary values and the count of unresolved rows. Unknown value is never replaced by zero.

The state rows intentionally retain stock-key granularity. Product/Warehouse summaries can aggregate these exact rows without treating individual locations as independent accounting policies.

## Monetary Kardex

Monetary Kardex reads `inventory_valuation_entries` in canonical chronology for one Company + Product + Warehouse stream.

It returns:

- opening resolved cost,
- each valuation entry's monetary delta,
- running resolved cost,
- explicit unresolved state/reason,
- closing resolved cost,
- next cursor.

An unresolved entry does not change `runningResolvedCost`; it increments diagnostics instead. This avoids silently treating unknown cost as zero while still allowing the resolved portion of the stream to be inspected.

## FIFO Layer Detail

Layer detail reads current `inventory_valuation_cost_layers` and defaults to open layers (`remaining_quantity <> '0'`). It exposes source movement/valuation-entry identity, opening chronology, original/remaining quantity, unit cost, original/remaining monetary value, and revision.

This is intentionally a **current layer report**. Remaining quantities in the current layer table must never be presented as historical/as-of layer state. Historical valuation comes from dated valuation state/entries. A future requirement for historical layer reconstruction must replay authoritative facts instead of relabeling today's layer balances.

## Unresolved Diagnostics

The unresolved report reads valuation entries whose `cost_state = 'unresolved'` and preserves the reason, quantity, chronology, method and currency. It can be narrowed by Product, Warehouse and start date.

Typical reasons include missing inbound cost, insufficient cost basis, negative-stock deferral, and upstream unresolved cost.

## Recalculation Status

The status query compares authoritative Phase 20 movement facts with valuation entries and reports:

- latest movement business date,
- latest valued business date,
- unresolved/missing valuation count,
- current valuation stream revision when a Product stream is requested,
- `empty`, `current`, or `attention-required`.

A movement without a valuation entry is treated as requiring attention, not as a zero-value movement.

## Scope and Security

Warehouse-bearing reports apply existing Company/Branch warehouse visibility semantics. Application/UI callers must additionally require the Step 15 `inventory.valuation.view` permission; exports require `inventory.valuation.export`.

Authorization remains outside the SQL reader so the reader stays reusable in Desktop and future server adapters.

## Argin Bridge

Reports are projections and are never authoritative Bridge payloads. SQLite Desktop and future PostgreSQL/.NET Server independently query/rebuild their local projections from the same authoritative movement, policy and cost-input facts. No report row, running balance, layer report row or As-of total becomes synchronization truth.

## Deferred Work

- Persian RTL report workspace and drill-down UI: Step 17.
- Broader Domain/Application coverage: Step 18.
- Real SQLite query-plan/performance/upgrade/restart validation: Step 19.
- Release-wide validation and documentation reconciliation: Step 20.
