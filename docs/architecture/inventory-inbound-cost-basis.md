# Inventory Inbound Cost Basis and Landed Cost Allocation

## Purpose

Phase 21 Step 5 defines how a confirmed inbound quantity movement receives a reproducible monetary basis before FIFO or moving weighted-average valuation consumes it.

The model is persistence-neutral and does not own Purchase invoices, freight/vendor workflows, Treasury settlement or accounting posting.

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

## FIFO and Moving Average boundary

Step 5 creates monetary input. It does not perform outbound consumption.

- FIFO: resolved inbound basis feeds layer creation/state reception.
- Moving weighted average: resolved inbound basis feeds the monetary pool update.
- Step 6 owns issue/outflow cost calculation.

## Argin Bridge implications

Bridge-safe authoritative data consists of durable cost-basis/component/source identities and deterministic allocation inputs. Derived totals can be reproduced from those inputs and algorithm version.

Important requirements:

- never use SQLite row IDs as identity;
- preserve Phase 20 `movementId`;
- preserve source cost references;
- synchronize explicit allocation method and basis input where authoritative;
- preserve currency and exact monetary amount;
- use stable canonical line ordering for deterministic remainder assignment;
- do not synchronize rebuildable aggregate value projections as independent facts.

Live transport remains Phase 45 scope.

## Deferred concerns

Step 5 does not implement:

- Purchase invoice ownership;
- vendor/freight commercial workflow;
- persistence or migrations;
- authorization/audit application services;
- outflow cost consumption;
- transfer valuation;
- backdated recalculation;
- negative-stock/unresolved policy;
- accounting posting.
