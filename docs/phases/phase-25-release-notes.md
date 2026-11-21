# ArginAccounting v0.25.0 — Sales Posting

## Summary

Phase 25 introduces deterministic, replay-safe Sales accounting recognition from authoritative Sales commercial facts and Inventory Valuation outputs.

## Highlights

- Sales Posting domain/application package with durable source/version identity.
- Commercial posting:
  - Accounts Receivable debit;
  - Sales Revenue credit;
  - Output VAT credit.
- Stock cost posting:
  - COGS debit;
  - Inventory credit.
- Service-only Sales bypass Inventory/Valuation.
- Mixed invoices post commercial effects for all lines and cost effects only for stock lines.
- Automatic post-finalization orchestration with resumable pending states.
- Exactly-once business effect through idempotency, payload fingerprinting, optimistic concurrency and atomic persistence.
- Sales Return commercial reversal plus Inventory/COGS restoration from inbound return valuation.
- Sales Correction reverse-and-replace lineage.
- Immutable Journal provenance across Sales, Inventory, Movement and Valuation identities.
- Persian RTL Posting status/recovery UI.
- Desktop runtime wiring from Sales finalization and Inventory confirmation to Journal creation.
- Historical Inventory Valuation recovery for missing/chronology-blocked valuation entries.
- Controlled Moving Average -> FIFO historical transition handling.
- Zero-VAT regression fix.
- Fail-closed Sales account bootstrap to prevent implicit Trading/Manufacturing cross-model mappings.
- Automated Step 28 E2E coverage for stock, service, mixed, return, correction, replay/CAS, historical valuation and runtime persistence.
- Canonical reconciliation/accounting examples for Sales Posting.

## Accounting Model

Commercial recognition:

```text
Accounts Receivable    Dr
    Sales Revenue          Cr
    Output VAT             Cr
```

Stock cost recognition:

```text
COGS                   Dr
    Inventory              Cr
```

Sales Return:

```text
Sales Revenue          Dr
Output VAT             Dr
Inventory              Dr
    Accounts Receivable    Cr
    COGS                   Cr
```

## Important Reconciliation Rule

For stock Sales:

```text
Journal total may be greater than Invoice total
```

because one Journal contains both the commercial leg and the COGS/Inventory leg.

Correctness requires:

```text
A/R = Sales Grand Total
Revenue = Tax Base Amount
Output VAT = Tax Amount
COGS = absolute resolved outbound valuation cost
Inventory Relief = COGS
Total Debit = Total Credit
```

## Runtime Flow

```text
Finalized Sales Invoice
→ Inventory Issue
→ Confirmed Movement
→ FIFO/MWA Valuation
→ Sales Posting
→ Accounting Journal
```

For Sales Return:

```text
Finalized Sales Return
→ Inventory Receipt
→ Confirmed inbound Movement
→ inbound Valuation
→ reversal/restoration Posting
→ Accounting Journal
```

## Recovery

Supported pending/recovery states include:

- waiting-for-issue;
- waiting-for-confirmation;
- waiting-for-movement;
- waiting-for-valuation;
- retry;
- replay;
- manual review.

Historical valuation recovery includes controlled rebuild for chronology-blocked movements.

## Persistence

Migration:

```text
0037_sales_posting.sql
```

Core tables:

```text
sales_postings
sales_posting_rules
sales_posting_idempotency
sales_posting_journal_provenance
sales_posting_outbox
```

## Security

Permissions:

```text
sales.posting.view
sales.posting.execute
sales.posting.recover
sales.posting.trace.view
```

## Argin Bridge

Phase 25 preserves durable Sales source/version, Posting, Movement, Valuation, Journal, Idempotency and Outbox identities for future synchronization.

## Validation

Canonical release gate:

```bash
pnpm validate:phase25
```

The release must be created only after the quality gate is observed successful and the phase branch is merged to `main`.

## Release Identity

```text
Version: 0.25.0
Tag: v0.25.0
Title: ArginAccounting v0.25.0 — Sales Posting
```
