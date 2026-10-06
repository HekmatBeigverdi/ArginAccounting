# CR-24-01 — Below-Cost Sales Policy & Guard

Status: Approved and implemented during Phase 24 without renumbering the frozen 30-step plan.

## Decision

Below-cost control is a Sales commercial governance policy, therefore its policy/evaluation boundary belongs to Phase 24. Accounting recognition of the resulting margin/COGS remains Phase 25.

Company policy modes:
- `allow`: permit below-threshold sales while retaining evaluation facts.
- `warn`: permit but surface a warning.
- `require-approval`: finalization requires an authorized approval decision.
- `block`: finalization is prohibited while below threshold.

The policy also supports `minimumMarginBasisPoints`; zero means at-cost is acceptable. The threshold is measured as margin over authoritative cost, in basis points.

The Sales amount used by the guard is the **net commercial unit amount before VAT**: line tax base after discounts and charges divided by quantity. Raw list/unit price cannot bypass the guard by applying a later discount.

## Cost authority

The guard MUST use authoritative Phase 21 Inventory Valuation cost for stock products. It MUST NOT use:
- last purchase price;
- Product Master price;
- Sales selling price;
- a silent zero/default when valuation is unavailable.

Before Sales Invoice finalization there is no outbound Inventory movement and therefore no final outbound valuation entry yet. Phase 24 consequently requests a read-only cost quote from the current authoritative Phase 21 FIFO/MWA state for the selected warehouse and quantity. The quote records a deterministic valuation-basis revision. It is a finalization guard input, not final COGS.

Evaluation and persisted decision retain policy ID/revision, quote/basis identity, warehouse, margin and approval information so the decision is auditable and replayable.

An unresolved/unavailable cost produces `cost-unavailable`. Application finalization must apply an explicit company workflow for this state; it must never reinterpret unavailable cost as zero.

Services/non-stock lines are `not-applicable` to this Inventory-cost guard.

## Phase 24 operational implementation

CR-24-01 is implemented beyond the domain contract:

- SQLite migration `0036_sales_below_cost_guard.sql` persists append-only company policy revisions and finalization decisions.
- Policy changes and their shared Audit record commit atomically.
- Desktop exposes company policy management behind `sales.below-cost-policy.manage`.
- `require-approval` requires `sales.below-cost.approve` plus a mandatory approval reason.
- `warn` requires explicit user acknowledgement; `block` stops finalization.
- `cost-unavailable` stops finalization rather than assuming zero cost.
- Finalization re-evaluates the guard inside the mutation transaction, so UI preview cannot bypass the rule.
- Stock lines require explicit warehouse routing.
- Finalizing a stock Sales Invoice stages exactly one Inventory Issue Draft in the same local transaction.
- Finalizing a stock Sales Return stages exactly one Inventory Receipt Draft in the same local transaction.
- Sales finalization itself does not confirm the Inventory document and therefore does not directly change stock quantity.
- Guard decisions are keyed by the finalization submission identity and stored append-only.

## Example

SSD-512 selling unit price = 900,000 IRR; authoritative valuation unit cost = 1,000,000 IRR:

```text
margin = -100,000 IRR
margin = -10% = -1000 basis points
```

With mode `warn`, outcome is `warning`; with `require-approval`, outcome is `approval-required`; with `block`, outcome is `blocked`.

## Phase 25 handoff

Phase 25 MUST NOT recalculate COGS from the below-cost evaluation or selling price. The guard is a commercial decision aid/gate only.

Phase 25 must:
1. consume resolved outbound Inventory Valuation for COGS/Inventory Relief;
2. preserve valuation entry/revision lineage used for actual posting;
3. tolerate legitimate negative gross margin when policy allowed/approved the sale;
4. expose/report the actual posted gross margin from Revenue versus authoritative COGS;
5. never “correct” a loss-making sale by substituting selling price as inventory cost;
6. preserve the policy/approval trace alongside posting trace where available;
7. re-check posting prerequisites if valuation changed/recalculated before posting, using the authoritative posting valuation revision rather than mutating the historical Sales commercial snapshot;
8. preserve both the Phase 24 pre-finalization cost-quote/basis trace and the Phase 25 actual outbound valuation trace; they may legitimately differ if inventory state changes before Issue confirmation;
9. never use the Phase 24 cost quote itself as the COGS posting source.

## Acceptance

Automated tests cover allow/warn/approval/block semantics, minimum-margin threshold, discounted net-price guarding, service exclusion, unresolved cost, cost-quote lineage, persistence/migration, permission-gated UI, transactional finalization enforcement and Sales-to-Inventory draft staging contracts.
