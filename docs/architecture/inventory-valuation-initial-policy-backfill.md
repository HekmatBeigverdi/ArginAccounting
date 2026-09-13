# Inventory Valuation Initial Policy Activation and Historical Backfill

Phase 21 Step 17 requires the Persian RTL workspace to make the Company valuation policy operational, not merely display policy history.

## Initial policy

When a Company has no valuation policy, an authorized user may create exactly one initial policy with:

- Company scope;
- method `FIFO` or `Moving Weighted Average`;
- currency `IRR` unless the canonical currency contract states otherwise;
- `effectiveFrom` not later than the Company's first authoritative inventory movement;
- strategy version owned by the valuation domain;
- policy revision `1`.

The UI must never ask for a valuation method per Product, Warehouse, receipt or issue. The mutation is authorized by `inventory.valuation.policy.manage` and produces append-only shared Audit evidence for `inventory.valuation.policy.initial-set`.

## Activation workflow

The initial policy operation is:

`Policy -> authoritative Movement/Cost Input replay -> Valuation Entry -> FIFO Layer or MWA state -> dated Valuation State -> stream revision -> report refresh`

Existing manually resolved Cost Inputs and future Purchase/ERP Cost Inputs are consumed through the same authoritative boundary. The user must not re-enter a purchase price merely because the policy is created after the receipt.

The bootstrap mutation is idempotent by request identity. Policy and rebuildable valuation projections are committed through the SQLite valuation transaction; shared Audit evidence is recorded immediately at the Desktop/Application boundary using the same request identity/correlation identity.

## Existing inventory movements

Initial policy activation rebuilds earlier eligible inventory movements in canonical chronology. Missing active inbound cost blocks activation rather than fabricating zero cost.

Dated `inventory_valuation_states` snapshots are persisted after the last chronologically relevant movement for each Product/Warehouse/location/date. This is required so As-of reporting can distinguish, for example, the state after the first receipt from the state after a later receipt or issue.

Full reversal relationships are read from `inventory_all_stock_movements.reversal_of_movement_id`; a receipt that has been fully reversed must not remain in the manual unresolved-cost queue merely because the immutable original movement still exists. Workspace currentness checks likewise ignore compensated original/reversal pairs when deciding whether a movement is still missing valuation work.

Derived `Valuation Entry`, `Cost Layer`, `Valuation State` and monetary reports remain rebuildable projections. Movement, Cost Input and Policy remain authoritative facts for Argin Bridge.

## Transfer replay

A confirmed Warehouse transfer is not an independent inbound purchase and therefore its destination movement must never require a new Cost Input.

Initial policy activation groups active transfer movements by durable `transfer_id` and requires exactly one source movement and one destination movement with the same Company, document, line, Product, business date/order and absolute quantity. Malformed/non-conserving pairs block activation.

For FIFO:

- the source consumes its existing FIFO layers in chronology order;
- the exact consumed quantity and exact consumed monetary amount are carried to the destination;
- deterministic destination FIFO layers are created from each source-layer consumption;
- the source transfer valuation entry is negative and the destination transfer valuation entry is positive for the same amount;
- transfer net monetary effect is zero.

For Moving Weighted Average:

- the source issue uses its current moving-average pool;
- the exact resulting monetary amount is removed from the source and added unchanged to the destination pool;
- the destination does not recalculate transfer cost from any purchase price;
- transfer net monetary effect is zero.

This preserves the Step 7 transfer-cost-continuity invariant during the Step 17 historical bootstrap.

## Safety boundary

The Step 17 bootstrap path is intentionally conservative. It rejects unsupported chronology rather than guessing monetary results.

- Valid ordinary Warehouse transfer pairs are replayed with monetary continuity; invalid/incomplete/non-conserving transfer pairs block activation.
- For FIFO, a fully compensated receipt/reversal pair may be excluded from the bootstrap replay when it has no remaining monetary effect on the accepted chronology.
- Moving Weighted Average bootstrap is blocked when reversal pairs exist, because an inbound that is later reversed can still change the historical moving-average pool and the cost of intervening outflows. That scenario must use the full Reverse Valuation/Recalculation path rather than pair deletion.
- Negative stock during replay blocks activation.
- Mixed/non-IRR Cost Input currencies block the current IRR bootstrap instead of silently converting values.

Historical policy transitions after authoritative valuation begins are not direct edits. They use the controlled append-only transition workflow, with effective chronology, permission, Audit and recalculation.

## Owner acceptance

For the current FIFO acceptance scenario:

1. Receipt `000005`: 10 units with unit cost 10,000,000 IRR.
2. Receipt `000006`: 5 units with unit cost 14,000,000 IRR.
3. Receipt `000004`: 10 units, later fully reversed; it must not remain in the unresolved-cost exception queue.
4. Issue `000003`: 7 units.
5. Any valid transfer already present in Company history must replay without asking for a separate destination purchase cost and without creating net monetary value.
6. Activate Company FIFO from the first inventory movement date.
7. Rebuild valuation.
8. Current expected active inventory from the two priced receipts after the 7-unit issue is 8 units with 100,000,000 IRR remaining value, redistributed by Warehouse only if a valid transfer moved part of that stock.
9. Across all Warehouses, current FIFO layers must reconcile to the same Company/Product total monetary value after transfers.
10. Monetary Kardex transfer source/destination effects must net to zero.
11. As-of reports must reflect the Warehouse/location state after each chronologically relevant movement date.
12. Currentness must no longer remain `attention-required` only because immutable compensated reversal rows have no independent valuation entry.

Moving Weighted Average must be tested on a clean chronology without reversal first. Reversal-aware MWA acceptance is deferred until the full reverse-valuation replay path is wired end-to-end.
