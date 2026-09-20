# Inventory Transfer Cost Continuity

## Purpose

Phase 21 Step 7 defines how monetary inventory value follows a confirmed Phase 20 transfer from its source stock stream to its destination stock stream without creating profit, loss, or company-level inventory value change.

## Core invariant

For every ordinary transfer line:

`source monetary effect + destination monetary effect = 0`

Quantity conservation remains owned by Phase 20. Step 7 adds the corresponding monetary conservation rule.

The transfer engine consumes the exact source-side cost basis and credits the exact same smallest-currency-unit amount to the destination. The destination amount is not recomputed from a rounded unit cost.

## Movement pair requirements

A valid transfer valuation pair must have:

- the same non-empty `transferId`;
- the same Company, document, line and Product identity;
- the same business date and business order;
- one negative source movement and one positive destination movement;
- equal absolute quantity;
- different stock keys;
- no reversal identity on either movement.

Invalid pairs are rejected before valuation state is changed.

## Policy resolution

Both sides resolve the Company valuation policy effective on the transfer business date. The source and destination must resolve the same policy identity, method, strategy version and currency.

This keeps Product/Warehouse streams subordinate to the Company-scoped policy introduced in Step 4.

## FIFO continuity

For FIFO, Step 7 first consumes source layers using the Step 3 FIFO strategy. Every consumed source portion is then materialized at the destination as a new durable destination layer with:

- the exact consumed quantity;
- the exact consumed monetary amount;
- the same currency;
- a new caller-supplied durable destination layer identity.

Example:

- source layer A: 10 units / 1,000 IRR;
- source layer B: 5 units / 1,000 IRR;
- transfer quantity: 12 units.

Source consumption is:

- A: 10 / 1,000;
- B: 2 / 400.

Destination receives two new layers totaling 12 units / 1,400 IRR. Existing destination FIFO layers stay before these new transfer layers.

This preserves source traceability while giving the destination its own durable layer identities.

## Moving weighted average continuity

For moving weighted average, Step 7 obtains the exact monetary amount removed from the source pool and adds that integer amount directly to the destination pool.

If the source removes 1 unit costing 3 IRR from a `3 units / 10 IRR` pool, the destination receives exactly 3 IRR. The engine does not multiply a rounded unit cost such as `3.333333...` by quantity again.

That prevents transfer-only rounding drift.

## No artificial P&L

Ordinary internal transfer is a location change, not an economic consumption or sale. Therefore Step 7 exposes:

- negative source monetary effect;
- equal positive destination monetary effect;
- `netTotalCost = 0`.

Accounting posting remains outside Phase 21.

## Traceability

The transfer result retains:

- transfer identity;
- source and destination movement IDs;
- Company/Product identity;
- policy ID, method, strategy version and currency;
- quantity and carried unit cost;
- exact source and destination monetary effects;
- FIFO source layer consumptions;
- FIFO destination layers created from those consumptions.

This allows later reports to explain where destination inventory value originated.

## Argin Bridge implications

The calculation is persistence-neutral and deterministic. For the same authoritative movement pair, policy history, valuation states and caller-supplied durable destination layer IDs, Desktop and future Server nodes must derive the same result.

The contract does not rely on SQLite row IDs. Transfer and layer identities are durable inputs suitable for later synchronization envelopes.

## Deferred concerns

Step 7 does not implement:

- reversal of a transfer; Step 8 owns reverse valuation;
- backdated replay; Step 9 owns recalculation;
- negative-stock/deferred-cost policy; Step 10 owns that policy;
- repositories/transactions; Steps 11–13 own application and persistence integration;
- live Bridge transport; Phase 45 owns transport runtime.
