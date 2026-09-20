# Inventory Outflow Cost Calculation Engine

## Purpose

Phase 21 Step 6 defines the persistence-neutral monetary engine for ordinary inventory outflows. It converts an immutable Phase 20 negative quantity movement plus the valuation policy effective on that movement's business date and the corresponding valuation state into a deterministic monetary outflow result.

## Ownership boundary

This engine owns ordinary issue/outflow costing only.

It does not own:

- transfer cost continuity (Step 7);
- adjustment/reversal compensation semantics (Step 8);
- downstream backdated recalculation execution (Step 9);
- negative-stock/deferred-cost policy (Step 10);
- repositories or transactions (Steps 11-13);
- accounting journal posting.

Transfer and reversal movement facts are explicitly rejected by Step 6 so later steps can define their monetary semantics without hidden behavior here.

## Historical policy resolution

The engine resolves `InventoryValuationPolicy` by:

- movement `companyId`;
- Product/Warehouse valuation context;
- movement `businessDate`.

It never applies the newest/current Company policy blindly to historical movements. A 2026 movement therefore remains costed under the policy effective in 2026 even when the Company has a later 2027 policy transition.

The supplied valuation state must match the resolved method. A FIFO policy cannot consume a moving-average state and vice versa.

## FIFO outflow

For FIFO the engine delegates exact calculation to the versioned FIFO strategy from Step 3.

The result contains:

- signed negative `totalCost`;
- calculated `unitCost`;
- updated FIFO state;
- exact layer consumptions (`layerId`, consumed quantity, allocated cost);
- source movement/document/line identity;
- resolved policy identity and strategy version.

Layer consumptions are the monetary trace from an outbound movement back to the inbound cost basis established in Step 5.

## Moving weighted average outflow

For moving weighted average the engine delegates to the Step 3 moving-average strategy.

The result contains:

- signed negative `totalCost`;
- current average `unitCost` for the issued quantity;
- updated remaining quantity/cost pool;
- source movement identity;
- resolved policy identity and strategy version.

No synthetic FIFO-style consumption rows are fabricated for moving average.

## Insufficient quantity

Step 6 does not invent negative-stock valuation. If the strategy state cannot cover the requested quantity, the versioned strategy raises `VALUATION_STRATEGY_INSUFFICIENT_QUANTITY`.

Step 10 will decide whether the application blocks the movement, defers valuation or records an explicit unresolved-cost condition.

## Determinism and Argin Bridge

The engine is pure and persistence-neutral. Given the same:

1. immutable Phase 20 movement;
2. authoritative Company policy history;
3. exact valuation state;
4. strategy version;

Desktop SQLite and a future PostgreSQL/.NET server derive the same result.

The output preserves durable identities instead of SQLite row identifiers, including movement/document/line and policy IDs. FIFO additionally preserves durable cost-layer IDs in the consumption trace. These facts are suitable inputs for later persistence, audit, reporting, recalculation and Bridge contracts without making a derived projection independently authoritative.

## Public contract

The engine is exported from the Inventory package root and from:

`@argin/inventory/outflow-cost`

The primary operation is `calculateInventoryOutflowCost(...)`.
