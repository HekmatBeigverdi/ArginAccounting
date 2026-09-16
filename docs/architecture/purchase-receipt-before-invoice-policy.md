# Purchase Receipt-Before-Invoice and Cost Resolution Policy

## Purpose

Step 11 freezes the Purchase-side policy for confirmed physical receipts whose final supplier invoice/cost is not yet available.

## Chosen policy

ArginAccounting uses **defer until authoritative supplier cost is available**.

A confirmed Inventory receipt may exist before its supplier invoice. Physical stock confirmation is not blocked merely because Purchase cost is missing, but Inventory Valuation remains explicitly unresolved. Zero cost is never synthesized.

## Resolution states

- `awaiting-supplier-invoice`: no receipt/invoice match exists yet.
- `partial-invoice-match`: only part of the confirmed Inventory movement quantity is covered by authoritative invoice matches.
- `supplier-invoice-cost-unavailable`: full quantity is matched, but an eligible confirmed Purchase commercial fact is still unavailable.
- resolved: full movement quantity is covered by eligible confirmed Purchase invoice facts and Step 10 can produce a resolved Cost Input.

The decision always preserves movement quantity, matched quantity and remaining quantity as canonical decimal strings.

## Inventory boundary

Missing inbound cost does not block physical Inventory confirmation. This matches the Phase 21 cost-resolution policy (`missingInboundCostAction = defer`). Valuation remains unresolved until Purchase supplies a resolved Cost Input.

When a previously unresolved movement becomes resolved, valuation must be recalculated from that movement with reason `cost_basis_changed`. Step 11 records that orchestration intent; the actual application command/UoW wiring belongs to Steps 13–14.

## Prohibited behavior

- Never substitute zero cost for missing Purchase cost.
- Never estimate/provision cost automatically in this policy.
- Never mark a movement resolved from only partial quantity coverage.
- Never bypass Step 10 eligibility, Company/Product/source identity, currency or confirmed-invoice checks.
- Never rewrite the historical Inventory movement when the invoice arrives later.

## Bridge boundary

The unresolved/resolved decision is derived from authoritative Inventory movement, Purchase matches and Purchase commercial facts. Bridge synchronization should preserve those source facts and durable IDs; derived decision state can be recomputed.

## Deferred scope

- Purchase return/correction and replacement cost flows: Step 12.
- Application/repository/UoW orchestration: Steps 13–16.
- Idempotent replay/concurrency: Step 17.
- Live Bridge transport/conflict handling: later Bridge phase.
