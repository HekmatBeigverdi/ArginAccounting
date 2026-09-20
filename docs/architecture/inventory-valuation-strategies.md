# Inventory Valuation Strategies

## Purpose

Phase 21 Step 3 defines the persistence-neutral strategy contract used to value confirmed inventory quantity facts. The strategy layer is pure: given the same ordered state and the same input, it must return the same valuation result on Desktop SQLite and on a future Argin Bridge server implementation.

## Strategy Identity

Every strategy has a stable identity composed of:

- valuation method (`fifo` or `moving_average`);
- algorithm version;
- rounding mode.

The initial algorithm version is `1`. Consumers must not silently execute a state created by an unsupported strategy version. A future algorithm change that can alter monetary results requires a new version and deterministic replay/recalculation rules.

## Numeric Rules

Quantity remains the exact canonical decimal string defined by the Phase 20 Inventory quantity model.

Monetary totals follow the Platform Money invariant: safe integer amount in the smallest currency unit. For IRR this means integer Rials.

Unit cost remains an exact canonical decimal string because moving weighted average may produce a fractional per-unit amount even when the final monetary total is an integer.

Binary floating-point arithmetic is forbidden in valuation arithmetic. Strategy calculations parse decimal strings into integer coefficients/scales and use `BigInt` internally.

The fixed monetary rounding mode for strategy version 1 is `half-away-from-zero`.

Calculated display/unit cost uses a deterministic scale of 12 decimal places before canonical trailing-zero removal. This scale is part of the version-1 algorithm contract; changing it requires an algorithm-version change if results may differ.

## FIFO

FIFO state is an ordered list of open monetary layers. Each layer contains:

- durable layer identity;
- remaining exact quantity;
- remaining integer monetary cost;
- currency.

Inbound valuation appends a new layer to the end of the ordered layer state.

Outbound valuation consumes layers from oldest to newest. Full-layer consumption takes the exact remaining monetary amount of that layer. Partial consumption allocates the layer's remaining monetary amount proportionally to consumed quantity and rounds once using the version-1 rounding rule. The unconsumed monetary remainder stays on the same layer.

This remainder rule is required for monetary conservation. Repeated partial consumption followed by full consumption of the remainder must consume exactly the original layer monetary amount.

FIFO never changes Phase 20 movement chronology. Repository/Application code is responsible for supplying state in canonical business order.

## Moving Weighted Average

Moving-average state contains:

- exact on-hand quantity;
- total integer monetary cost of that quantity;
- currency.

Inbound valuation adds inbound exact quantity and rounded inbound monetary cost to the pool.

Outbound valuation allocates monetary cost proportionally from the current quantity/cost pool. A full issue consumes the exact remaining monetary balance rather than recalculating and rounding it again.

This approach preserves monetary conservation while still allowing an exact deterministic average unit cost to be exposed from `totalCost / quantity`.

## Insufficient Quantity

Step 3 does not invent cost for negative stock. If an outbound request exceeds the supplied strategy state, the strategy returns `VALUATION_STRATEGY_INSUFFICIENT_QUANTITY`.

The business policy for blocking, deferring, or leaving cost unresolved when quantity becomes negative belongs to Phase 21 Step 10. The pure strategy engine must not guess that policy.

## Currency

One strategy state is single-currency. Combining layers/pools from different currencies is rejected with `VALUATION_STRATEGY_CURRENCY_MISMATCH`.

Currency conversion and exchange-rate ownership are outside this strategy contract.

## Public Consumer Contract

The strategy contract is exposed through the `@argin/inventory/valuation-strategy` package subpath. Consumers select a strategy through `getInventoryValuationStrategy(method, version)` rather than embedding FIFO or moving-average implementation details.

This keeps Application and future Argin Bridge adapters independent from implementation classes and allows later strategy versions/methods to be introduced behind the same boundary.

## Argin Bridge Implications

The future Bridge must persist/transmit strategy method and version with authoritative valuation facts. Replaying the same Phase 20 movement order, cost inputs, currency, method and version must produce the same monetary result on both runtimes.

Rebuildable strategy state is not an independent synchronization truth. The authoritative facts and algorithm identity are sufficient to deterministically reconstruct layers/average state once the later persistence and synchronization contracts are implemented.

## Step 3 Boundaries

Step 3 implements only pure strategy behavior and deterministic arithmetic. It does not implement:

- Product/Warehouse policy selection (Step 4);
- persisted cost-layer repositories or landed-cost basis (Step 5+);
- negative-stock business policy (Step 10);
- SQLite persistence (Step 12);
- Bridge envelopes/transport (Step 14);
- Posting/Journals.
