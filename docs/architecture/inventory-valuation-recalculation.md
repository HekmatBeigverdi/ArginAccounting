# Inventory Valuation Recalculation

## Purpose

Phase 21 Step 9 defines deterministic invalidation and replay for backdated or historically changed valuation inputs. Quantity facts from Phase 20 remain immutable; only derived monetary valuation state is rebuilt.

## Recalculation triggers

A recalculation plan can be created for:

- backdated inventory movement insertion,
- movement chronology/content changes that affect valuation,
- inbound cost-basis or landed-cost changes,
- linked reversal (from the chronology point of the original movement),
- Company valuation-policy transition/change from its effective date.

## Earliest affected point

Movement/cost-basis changes use the exact canonical movement point:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`.

A reversal starts conservatively from the original movement's `businessDate/businessOrder`, because the reversal contract intentionally preserves the original chronology and Step 9 must rebuild every deterministic tie-breaker at that point.

A Company policy change starts at `effectiveFrom` and affects every Product in that Company from that date onward.

## Affected scope

For a movement, cost-basis change or reversal, the safe recalculation scope is Company + Product across all warehouses/locations. This is intentionally broader than one Warehouse because transfer valuation can propagate the Product's monetary basis from one warehouse to another.

For a Company valuation-policy change, the scope is the whole Company because the policy is Company-scoped under CR-21-001.

## Deterministic ordering

Recalculation reuses the Phase 20 canonical movement comparator:

1. business date,
2. business order,
3. document ID,
4. line ID,
5. movement ID.

Input order from a database, sync transport or API never controls monetary replay order.

## Replay boundary

`replayInventoryValuationPlan` is persistence-neutral. It accepts a seed state and a pure movement applier. The Application layer later supplies the seed immediately before the invalidation boundary and invokes the Step 5–8 valuation primitives for each replayed movement.

This separation prevents Step 9 from introducing SQLite repositories, transaction orchestration or application ports ahead of Steps 11–13.

## Policy chronology

Replay must resolve the Company valuation policy independently for each movement's historical business date. It must never apply only the Company's newest policy to the complete replay window.

## Argin Bridge

The plan contains durable movement IDs and canonical chronology only. It does not depend on SQLite row IDs. Given the same authoritative movements, cost inputs, policy history, algorithm versions and seed state, Desktop and future Server implementations can replay the same sequence and derive the same monetary result.

Live synchronization transport, acknowledgements and distributed conflict handling remain Phase 45 scope.
