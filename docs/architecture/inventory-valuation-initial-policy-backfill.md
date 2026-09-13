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

The UI must never ask for a valuation method per Product, Warehouse, receipt or issue.

## Activation workflow

The initial policy operation is atomic:

`Policy -> authoritative Movement/Cost Input replay -> Valuation Entry -> FIFO Layer or MWA state -> Valuation State -> report refresh`

Existing manually resolved Cost Inputs and future Purchase/ERP Cost Inputs are consumed through the same authoritative boundary. The user must not re-enter a purchase price merely because the policy is created after the receipt.

## Existing inventory movements

Initial policy activation must rebuild earlier eligible inventory movements from canonical chronology. Missing active inbound cost blocks activation rather than fabricating zero cost.

Full reversal relationships are read from `inventory_all_stock_movements.reversal_of_movement_id`; a receipt that has been fully reversed must not remain in the manual unresolved-cost queue merely because the immutable original movement still exists.

Derived `Valuation Entry`, `Cost Layer`, `Valuation State` and monetary reports remain rebuildable projections. Movement, Cost Input and Policy remain authoritative facts for Argin Bridge.

## Safety boundary

The Step 17 bootstrap path is intentionally conservative. It must reject unsupported chronology rather than guess monetary results. Transfer chronology requiring cross-Warehouse cost continuity is delegated to the full deterministic recalculation engine from Steps 7 and 9.

Historical policy transitions after authoritative valuation begins are not direct edits. They use the controlled append-only transition workflow, with effective chronology, permission, Audit and recalculation.

## Owner acceptance

For the current FIFO acceptance scenario:

1. Receipt 10 units with unit cost 10,000,000 IRR.
2. Receipt 5 units with unit cost 14,000,000 IRR.
3. A separate receipt that has been fully reversed must not require manual cost resolution when it has no remaining valuation effect in the accepted chronology.
4. Issue 7 units.
5. Activate Company FIFO from the first inventory movement date.
6. Rebuild valuation.
7. Current expected active inventory from the two priced receipts after the 7-unit issue is 8 units with 100,000,000 IRR remaining value.
8. Monetary Kardex and current FIFO layers must reconcile to that result.

Moving Weighted Average must be tested separately because every chronologically relevant inbound cost can affect the average pool, including an inbound later reversed after intervening movements.
