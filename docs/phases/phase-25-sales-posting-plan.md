# Phase 25 — Sales Posting — Implementation Plan

## Status

Not started. This plan is prepared during Phase 24 to freeze the required Sales-to-Inventory-to-Accounting handoff before implementation begins.

## Mission

Phase 25 converts authoritative Phase 24 Sales commercial facts and Phase 21 Inventory Valuation outputs into balanced, idempotent Accounting journal effects without duplicating Sales, Inventory or Valuation authority.

Mandatory reference: [Phase 24 -> Phase 25 Sales Fulfillment and Posting Handoff](../architecture/sales-fulfillment-posting-handoff.md).

## Non-negotiable dependency chain

```text
Finalized Sales Invoice
 -> Inventory Issue Draft
 -> Inventory Issue finalized/confirmed
 -> Inventory Movement
 -> quantity decrease
 -> resolved FIFO/MWA valuation
 -> Sales Posting
 -> Journal Voucher
```

For stock products, Phase 25 MUST NOT post COGS/Inventory Relief before the related Inventory movement exists and its valuation is resolved.

Commercial posting uses Sales facts; cost posting uses Inventory Valuation facts. Selling price is never a cost input.

## Planned scope

1. Baseline, handoff contract and ownership verification.
2. Sales Posting domain and durable posting identity.
3. Commercial posting input from immutable Sales snapshots.
4. Revenue account resolution.
5. Accounts Receivable account resolution.
6. Output VAT account resolution.
7. Commercial posting calculation and balancing.
8. Stock-fulfillment prerequisite contract.
9. Inventory Issue lineage resolution.
10. Outbound Inventory Movement lineage resolution.
11. Resolved FIFO/MWA valuation prerequisite.
12. COGS account resolution.
13. Inventory account resolution.
14. COGS / Inventory Relief posting calculation.
15. Mixed stock + service invoice orchestration.
16. Service-only invoice posting path.
17. Automatic post-finalization orchestration and resumable pending state.
18. Idempotency and exactly-once Journal effect.
19. Optimistic concurrency and posting CAS.
20. Atomic Unit of Work / outbox boundary where cross-module work cannot share one local transaction.
21. Sales Return commercial reversal.
22. Sales Return Inventory Receipt / valuation cost restoration.
23. Sales Correction and replacement/reversal lineage.
24. Journal Voucher creation and immutable source provenance.
25. Posting status, recovery and deterministic retry.
26. Permissions, approval/audit and operational trace.
27. Persian RTL posting status/recovery UI.
28. Automated integration and E2E stock/service/return scenarios.
29. Documentation, reconciliation and accounting examples.
30. Quality Gate, merge and release.

Step numbering is provisional until Phase 25 formally starts; the scope/invariants in this document and the handoff document are mandatory unless changed by an explicit approved Change Request.

## Required accounting effects

Commercial leg (illustrative):

```text
Accounts Receivable    Dr
    Sales Revenue          Cr
    Output VAT             Cr
```

Cost leg for stock products:

```text
COGS                   Dr
    Inventory              Cr
```

Sales Return reverses/adjusts the corresponding commercial and inventory-cost effects using explicit source lineage, not mutable historical edits.

## Definition of Done additions

Phase 25 cannot be released merely because a Journal Voucher can be generated. Release requires proof that:

- a finalized stock invoice stages exactly one Inventory Issue;
- invoice finalization itself does not alter stock;
- Inventory confirmation/finalization is the quantity-decrease authority;
- COGS waits for resolved valuation;
- revenue/VAT/receivable and COGS/inventory amounts come from their separate authoritative sources;
- replay and recovery cannot duplicate Inventory or Journal effects;
- service-only, mixed, stock-only and Sales Return paths are covered;
- Journal lines retain Sales document/line and Inventory movement/valuation provenance sufficient for audit and reversal.
