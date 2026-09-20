# Inventory Inbound Cost Basis and Landed Cost Allocation

## Purpose

Phase 21 Step 5 defines how a confirmed inbound quantity movement receives a reproducible monetary basis before FIFO or moving weighted-average valuation consumes it.

The model is persistence-neutral and does not own Purchase invoices, freight/vendor workflows, Treasury settlement or accounting posting.

CR-21-002 clarifies that Phase 21 must also expose a bounded manual/fallback Application path for resolving a confirmed inbound movement when no upstream Purchase/ERP source has supplied monetary cost yet. This path creates the same authoritative Cost Input described here; it is not a separate UI-only price field.

## Purchase cost, sales price and inventory cost are different concepts

ArginAccounting must keep these concerns separate:

- **Purchase price** belongs to the Purchase transaction/line and is the commercial amount agreed with the supplier.
- **Sales price** belongs to Sales pricing/price lists and/or the Sales invoice line. It is not an Inventory Valuation input.
- **Inventory cost** is derived from authoritative inbound Cost Inputs and the Company valuation policy (FIFO or Moving Weighted Average).

For a normal purchase flow, the Purchase invoice/receipt integration should automatically provide the inbound Cost Input used by Inventory Valuation. Manual entry in the valuation workspace is therefore a fallback and operational repair path for cases such as legacy receipts, opening/manual receipts, migration/import, or an inbound movement whose upstream commercial source has not yet supplied cost.

Changing a market sales price never changes the historical inventory Cost Input. Likewise, a higher purchase price for a future procurement does not rewrite the cost of an old receipt. If an old receipt's purchase cost was entered incorrectly, or a provisional supplier amount becomes final, use the controlled **cost correction** workflow with a reason and downstream recalculation where derived valuation already exists.

This separation also matches the Tadbir/Mirza reference workflow reviewed for ArginAccounting: Purchase entry captures item quantity and unit value plus purchase expenses/discounts; purchase and sales price lists are separate master/commercial concepts; inventory valuation remains a distinct costing concern.

## Authoritative input

Each inbound basis line carries durable source identity:

- `basisLineId`
- Phase 20 `movementId`
- `productId`
- `warehouseId`
- exact base-unit quantity
- base monetary cost
- currency
- optional explicit allocation weight

Later Purchase/ERP modules may provide these cost inputs through bounded application contracts. Inventory Valuation owns only the allocation and valuation mechanics.

A manual source is valid when the confirmed inbound movement is eligible for valuation but no upstream monetary source has resolved it. Manual resolution must still preserve durable Cost Input identity, `movementId`, explicit currency, source metadata, request identity, permissions, Audit evidence and deterministic recalculation semantics. Missing cost remains unresolved until this succeeds.

## Landed cost components

A landed-cost component contains:

- durable `componentId`;
- source-system/source-document reference;
- exact safe-integer monetary amount;
- currency;
- explicit allocation method.

Supported Step 5 allocation methods are:

1. `quantity` — proportional to exact inbound base quantity;
2. `value` — proportional to each line's base monetary cost;
3. `weight` — proportional to an explicitly supplied positive weight basis.

No allocation basis is inferred. Missing weight, zero aggregate basis, mixed currencies or invalid amounts are rejected.

## Deterministic allocation and rounding

Allocation arithmetic uses integer/decimal `BigInt` mechanics rather than binary floating point.

For each landed-cost component, proportional line allocations are rounded deterministically. Any smallest-unit remainder is assigned to the final eligible line in stable input order so that:

`sum(line allocations) == component amount`

This conservation rule is mandatory for repeatability and auditability.

Callers that require canonical cross-node replay must supply lines in canonical movement/business order; persistence insertion order must never be used as hidden ordering.

## Resolved inbound basis

For each line:

`totalCost = baseCost + allocatedLandedCost`

Exact unit cost is derived from `totalCost / quantity` at deterministic 12-decimal precision, matching the valuation strategy calculation scale.

The resolved basis can be mapped directly to the Step 3 `InventoryValuationInboundInput`. FIFO callers additionally provide the durable cost-layer identity; moving-average callers consume the same cost basis without a layer identity requirement.

## Manual resolution and correction

Manual entry is a bounded authoritative source, not a mutation of the confirmed receipt line.

A manual resolution request must:

- reference one eligible confirmed inbound `movementId`;
- carry explicit monetary amount/currency and source metadata;
- use the Step 13 idempotency/concurrency boundary;
- use Step 15 permission/Audit/traceability rules;
- persist through the Step 11/12 Application and repository contracts;
- invalidate/recalculate downstream derived valuation from the earliest affected chronology point through Step 9.

Correction of an existing resolved basis is explicit. It must never silently overwrite cost. A correction requires reason, before/after evidence, authorization, concurrency validation and recalculation.

The Step 17 workspace therefore exposes two separate surfaces:

- **Unresolved inbound costs** — register a missing purchase/inbound cost.
- **Registered inbound costs** — review the currently stored unit/total cost and invoke controlled correction.

If a correction is requested after derived valuation already exists, the system must not patch FIFO/MWA projections directly. It must route through the deterministic recalculation path. Until that recalculation mutation is fully wired end-to-end, such a correction is blocked rather than producing inconsistent historical valuation.

## FIFO and Moving Average boundary

Step 5 creates monetary input. It does not perform outbound consumption.

- FIFO: resolved inbound basis feeds layer creation/state reception.
- Moving weighted average: resolved inbound basis feeds the monetary pool update.
- Step 6 owns issue/outflow cost calculation.

The user does not choose the valuation method on an individual receipt or Cost Input. The Company policy effective for chronology selects FIFO or Moving Weighted Average.

## Argin Bridge implications

Bridge-safe authoritative data consists of durable cost-basis/component/source identities and deterministic allocation inputs. Derived totals can be reproduced from those inputs and algorithm version.

Important requirements:

- never use SQLite row IDs as identity;
- preserve Phase 20 `movementId`;
- preserve source cost references;
- synchronize explicit allocation method and basis input where authoritative;
- preserve currency and exact monetary amount;
- use stable canonical line ordering for deterministic remainder assignment;
- do not synchronize rebuildable aggregate value projections as independent facts;
- manually resolved Cost Inputs use the same authoritative versioned Bridge representation as future Purchase/ERP-sourced Cost Inputs.

Live transport remains Phase 45 scope.

## Deferred concerns

Step 5 does not implement:

- Purchase invoice ownership;
- vendor/freight commercial workflow;
- sales price lists or Sales invoice pricing;
- persistence or migrations;
- authorization/audit application services;
- outflow cost consumption;
- transfer valuation;
- backdated recalculation;
- negative-stock/unresolved policy;
- accounting posting.

Those concerns remain owned by their later Phase 21 steps or future commercial/accounting phases. CR-21-002 does not change those ownership boundaries; it only ensures the existing inbound-cost model is reachable end-to-end from the Step 17 workspace when no upstream source has resolved cost.