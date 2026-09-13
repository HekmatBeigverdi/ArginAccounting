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

## Safety boundary

The Step 17 bootstrap path is intentionally conservative. It rejects unsupported chronology rather than guessing monetary results.

- Transfer chronology requiring cross-Warehouse cost continuity is delegated to the full deterministic recalculation engine from Steps 7 and 9.
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
5. Activate Company FIFO from the first inventory movement date.
6. Rebuild valuation.
7. Current expected active inventory from the two priced receipts after the 7-unit issue is 8 units with 100,000,000 IRR remaining value.
8. Current FIFO layers must reconcile to:
   - 3 units from the 10,000,000 IRR layer = 30,000,000 IRR;
   - 5 units from the 14,000,000 IRR layer = 70,000,000 IRR.
9. Monetary Kardex must reconcile to +100,000,000, +70,000,000, -70,000,000 and a 100,000,000 IRR closing balance for the accepted active replay.
10. As-of after the first receipt must show 10 units / 100,000,000 IRR; after the second receipt it must show 15 units / 170,000,000 IRR; after the 7-unit issue it must show 8 units / 100,000,000 IRR.
11. Currentness must no longer remain `attention-required` only because immutable compensated reversal rows have no independent valuation entry.

Moving Weighted Average must be tested on a clean chronology without reversal first. Reversal-aware MWA acceptance is deferred until the full reverse-valuation replay path is wired end-to-end.
