# Inventory Adjustment, Reversal and Reverse Valuation

## Scope

Phase 21 Step 8 defines monetary behavior for positive/negative inventory adjustments and linked reversal compensation without rewriting immutable Phase 20 quantity history.

## Positive adjustment / opening

Positive quantity adjustments consume a resolved inbound cost basis. The authoritative `totalCost` from that basis is preserved exactly; it is not reconstructed from rounded unit cost. FIFO creates a new durable layer. Moving Weighted Average adds exact quantity and exact integer cost to the current pool.

## Negative adjustment

Negative adjustments consume current valuation state through the effective historical Company policy. FIFO returns exact layer consumptions. Moving Weighted Average removes the proportional pool cost. Insufficient quantity remains deferred to Step 10 policy.

## Reversal

A reversal is a compensating monetary fact linked by `reversalOfMovementId`. Its monetary amount is the exact opposite of the original valuation fact. It preserves the original policy/method/version/currency identity even if the Company's current valuation policy has changed since the original movement.

A reversal does not directly mutate current derived state. It marks recalculation as required from the original movement chronology; Step 9 performs deterministic rebuild.

## Bridge

All identities are durable and independent of SQLite row IDs. The original valuation fact remains authoritative for reversal compensation and can be replayed consistently by Desktop and future Server implementations.
