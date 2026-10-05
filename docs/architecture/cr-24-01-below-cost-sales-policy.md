# CR-24-01 — Below-Cost Sales Policy & Guard

Status: Approved and implemented during Phase 24 without renumbering the frozen 30-step plan.

## Decision

Below-cost control is a Sales commercial governance policy, therefore its policy/evaluation boundary belongs to Phase 24. Accounting recognition of the resulting margin/COGS remains Phase 25.

Company policy modes:
- `allow`: permit below-threshold sales while retaining evaluation facts.
- `warn`: permit but surface a warning.
- `require-approval`: finalization requires an authorized approval decision.
- `block`: finalization is prohibited while below threshold.

The policy also supports `minimumMarginBasisPoints`; zero means at-cost is acceptable and only negative gross margin falls below the threshold.

## Cost authority

The guard MUST use authoritative Phase 21 Inventory Valuation cost for stock products. It MUST NOT use:
- last purchase price;
- Product Master price;
- Sales selling price;
- a silent zero/default when valuation is unavailable.

Evaluation retains policy ID/revision and valuation entry ID/revision so the decision is auditable and replayable.

An unresolved/unavailable cost produces `cost-unavailable`. Application finalization must apply an explicit company workflow for this state; it must never reinterpret unavailable cost as zero.

Services/non-stock lines are `not-applicable` to this Inventory-cost guard.

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
7. re-check posting prerequisites if valuation changed/recalculated before posting, using the authoritative posting valuation revision rather than mutating the historical Sales commercial snapshot.

## Acceptance

Automated tests cover allow/warn/approval/block semantics, minimum-margin threshold, service exclusion, unresolved cost and valuation lineage mismatch.
