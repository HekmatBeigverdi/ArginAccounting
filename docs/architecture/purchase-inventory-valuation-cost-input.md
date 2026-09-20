# Purchase Inventory Valuation Cost Input Integration

Phase 22 Step 10 connects confirmed Purchase commercial facts to the authoritative Inventory Valuation Cost Input boundary established in Phase 21.

## Ownership

Purchase owns supplier commercial pricing. Inventory owns confirmed quantity movements. Inventory Valuation owns FIFO/MWA and consumes resolved inbound cost bases. Purchase never reimplements FIFO/MWA and Inventory Valuation does not ask the operator to re-enter normal supplier pricing.

## Eligibility

A resolved Purchase Cost Input requires:

- a positive confirmed Inventory inbound movement;
- one or more Receipt/Invoice match facts that fully cover that movement quantity;
- confirmed `supplier-invoice` commercial facts;
- `stock-product` lines only;
- matching Company and Product identities;
- one currency across all commercial facts contributing to the movement.

If the movement is only partially matched, or an authoritative commercial fact is still missing, the provider returns `null`. This means unresolved cost. Zero is never substituted silently.

## Cost Basis

The normal Purchase base cost is the Step 7 line `taxBaseAmount`:

`net after discount + line charges`

VAT/tax amount is excluded from the normal valuation base in this Step 10 contract. External landed-cost components are not invented here; later policy may add explicitly capitalizable components through the existing Inventory inbound-cost model.

For a Purchase line distributed across multiple receipt matches, tax-base cost is allocated proportionally by canonical base quantity. Allocation uses deterministic cumulative rounding in stable receipt/match order. This guarantees that when the full invoice-line quantity is matched, allocated costs sum exactly to the Purchase line tax base and rounding remainder is assigned deterministically.

## Movement-level Resolution

Resolution is evaluated per Inventory movement, not per entire supplier invoice. A six-unit receipt can be fully costed from six matched invoice units even if the supplier invoice contains ten units and four remain for a later receipt.

A movement whose matched quantity is lower than its movement quantity remains unresolved. A matched quantity greater than the movement quantity is invalid.

## Provenance

Each linked Cost Input preserves:

- durable `costInputId`;
- Inventory movement ID;
- Inventory receipt document/line IDs;
- Product and Company IDs;
- every Receipt/Invoice `matchId`;
- Purchase document/line IDs;
- matched base quantity;
- allocated base cost.

The derived `basis` is structurally compatible with `InventoryResolvedInboundCostBasis` and can be exposed through an `InventoryValuationCostInputProvider`-compatible adapter.

## Argin Bridge

The authoritative synchronized facts remain separate by ownership:

- Purchase invoice/commercial facts are Purchase-owned;
- receipt/invoice matches are durable Purchase workflow facts;
- Inventory movements are Inventory-owned quantity facts;
- resolved Cost Inputs are authoritative valuation inputs;
- FIFO layers, MWA state and valuation projections remain rebuildable derived state.

No SQLite row identity is used for cross-module linkage.

## Non-Scope

Step 10 does not choose receipt-before-invoice policy, create provisional cost, replace historical Cost Inputs, execute recalculation, persist Cost Inputs, implement idempotency/concurrency or post accounting entries. Those responsibilities remain in Step 11, Steps 13–18, Phase 21 valuation services and Phase 23 posting as defined by the roadmap.
