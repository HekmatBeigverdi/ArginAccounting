# Phase 25 — Sales Posting

## Status

Implementation through **Step 29 — Documentation, Reconciliation & Accounting Examples** is complete on branch `phase/25-sales-posting`.

The remaining phase action is:

```text
Step 30 — Quality Gate, Merge & Release
```

Release target:

```text
Version: 0.25.0
Tag:     v0.25.0
Title:   ArginAccounting v0.25.0 — Sales Posting
```

No release-quality PASS is claimed until Step 30 commands are executed and their results are recorded.

## Purpose

Phase 25 converts authoritative Sales commercial facts and authoritative Inventory Valuation cost facts into balanced, replay-safe Accounting Journal effects.

Phase 25 does **not** own:

- selling price;
- Sales document lifecycle;
- stock quantity;
- FIFO/MWA cost calculation;
- Accounting Journal lifecycle approval/editing.

It owns the Sales-specific accounting-recognition orchestration between those authorities.

## Ownership Matrix

| Fact / Effect | Authority |
|---|---|
| Customer, quantity sold, selling price, discounts, charges, output tax | Sales |
| Final Sales commercial snapshot | Sales |
| Inventory Issue / Receipt lifecycle | Inventory |
| Stock Movement and on-hand quantity | Inventory |
| FIFO / Moving Average valuation | Inventory Valuation |
| Revenue / A/R / Output VAT recognition | Sales Posting |
| COGS / Inventory relief or restoration | Sales Posting consuming Inventory Valuation |
| Journal Voucher lifecycle | Accounting |
| Settlement / payment | Treasury |

## Canonical Stock-Sale Flow

```text
Sales Invoice
    ↓
Finalize
    ↓
Inventory Issue Draft
    ↓
Issue Confirm
    ↓
Inventory Movement
    ↓
FIFO / Moving Average Valuation
    ↓
Sales Posting
    ↓
Accounting Journal Draft
```

Invoice finalization itself does not decrease stock.

The quantity decrease occurs only when Inventory confirms the Issue and creates the immutable Movement.

COGS is unavailable until the Movement has a resolved valuation.

## Commercial Posting

For a normal positive Sales Invoice:

```text
Accounts Receivable    Dr
    Sales Revenue          Cr
    Output VAT             Cr
```

The source is the immutable Phase 24 Sales commercial snapshot.

### Commercial invariants

```text
AR = Grand Total
Revenue = Tax Base Amount
Revenue + Output VAT = AR
```

For zero calculated VAT:

```text
taxAmount = 0
→ no Output VAT Journal line
```

A Tax definition with a zero calculated tax amount must not fabricate a VAT accounting effect.

## Cost Posting

For stock items:

```text
COGS                   Dr
    Inventory              Cr
```

The amount is the authoritative absolute cost of the resolved outbound Inventory Valuation entry.

Selling price is never substituted for inventory cost.

The pre-finalization CR-24-01 cost quote is a governance input only and is never a Phase 25 COGS source.

## Combined Journal

A stock Sales Invoice can therefore produce one Journal containing two independent accounting legs:

```text
Accounts Receivable    Dr
COGS                   Dr
    Sales Revenue          Cr
    Output VAT             Cr
    Inventory              Cr
```

This is why the total debit/credit of the Journal can be greater than the Sales Invoice total.

The Journal remains correct when:

```text
Total Debit = Total Credit
```

even though:

```text
Journal total ≠ Invoice total
```

because the Journal includes both the commercial effect and the cost/inventory effect.

See [Sales Posting Reconciliation and Accounting Examples](../accounting/sales-posting-reconciliation.md).

## Service-Only Sales

Service-only Sales bypass Inventory:

```text
Finalized Service Invoice
    ↓
Commercial Posting
    ↓
Accounting Journal
```

There is no:

- Inventory Issue;
- Inventory Movement;
- FIFO/MWA valuation;
- COGS;
- Inventory relief.

## Mixed Stock + Service Sales

For a mixed invoice:

```text
Commercial posting
→ all invoice lines

Cost posting
→ stock-product lines only
```

Service lines must never receive Inventory/COGS effects merely because they appear on the same invoice as stock goods.

## Resumable Posting State

The runtime persists Sales Posting state independently from the UI.

Canonical states:

```text
pending
ready
committed
blocked
```

Canonical dependency reasons:

```text
waiting-for-issue
waiting-for-confirmation
waiting-for-movement
waiting-for-valuation
```

Recovery decisions:

```text
wait
retry
replay
manual-review
none
```

The Persian RTL UI projects these states; it does not invent or recalculate accounting truth.

## Historical Valuation Recovery

Manual Phase 25 acceptance exposed historical Inventory Movements with no Valuation Entry.

The recovery chain now supports:

```text
Movement exists
Valuation Entry missing
    ↓
incremental diagnosis
    ↓
ordinary catch-up
or
controlled historical rebuild
```

Chronology-blocked movements do not expose an infinite ineffective retry.

Historical rebuild recreates derived valuation state from authoritative:

- Inventory Movements;
- Cost Inputs;
- effective valuation Policies.

It does not mutate authoritative Movement/Cost Input history.

### Moving Average to FIFO transition

When a historical policy changes from Moving Average to FIFO, valid pre-transition quantity/value is represented through a controlled FIFO transition layer before later FIFO outflow valuation.

A genuine FIFO shortage still fails closed.

## Sales Return

For stock Sales Return:

```text
Sales Return Finalized
    ↓
Inventory Receipt Draft
    ↓
Receipt Confirm
    ↓
positive Inventory Movement
    ↓
resolved inbound Valuation
    ↓
Return Posting
```

Commercial reversal:

```text
Sales Revenue          Dr
Output VAT             Dr
    Accounts Receivable    Cr
```

Cost restoration:

```text
Inventory              Dr
    COGS                   Cr
```

The returned selling price is not used to restore inventory cost.

Inventory restoration follows the return receipt's valuation lineage.

## Sales Correction

Correction is append-only:

```text
Original effect
    ↓
explicit reversal lineage
    ↓
Replacement effect
```

The implementation uses an explicit:

```text
reverse-and-replace
```

plan.

Historical finalized Sales, Inventory, Valuation and Journal facts are not rewritten in place.

## Exactly-Once Accounting Effect

A durable source identity includes:

```text
sourceSystem
sourceType
sourceDocumentId
sourceVersion
```

The accounting-recognition idempotency identity is derived from the source version and purpose.

Exact compatible replay:

```text
→ returns the existing Posting / Journal outcome
→ does not create another Journal
```

Same identity with an incompatible fingerprint:

```text
→ conflict
```

Posting CAS, Idempotency evidence, Journal creation/provenance and Outbox evidence share the atomic persistence boundary.

## Journal Provenance

Journal provenance retains enough identity to trace an accounting effect back through:

```text
Sales document/version
    ↓
Sales line
    ↓
Inventory document/line
    ↓
Movement
    ↓
Valuation Entry/revision
    ↓
Sales Posting
    ↓
Journal Voucher/line
```

This chain is designed for future Argin Bridge synchronization and diagnostics.

## Account Resolution

Sales Posting resolves:

- Accounts Receivable;
- Sales Revenue;
- Output VAT;
- COGS;
- Inventory Asset.

Missing, ambiguous, inactive or non-postable mappings fail closed.

### Automatic bootstrap safety

Automatic bootstrap is deliberately conservative.

Current exact built-in logical-key bootstrap:

| Role | Automatic logical key |
|---|---|
| Service Revenue | `revenue.operating.services` |
| Stock Sales Revenue | `revenue.operating.goods` |
| COGS | `costs.merchandise.sold` |
| Inventory Asset | `assets.current.inventory` |
| Accounts Receivable | `assets.current.receivables` |
| Output VAT | `liabilities.current.taxes` |

Automatic Trading-to-Manufacturing fallback is prohibited.

If the Company uses a Manufacturing chart but Product Master does not yet own an explicit purchased/manufactured classification, the system must not silently treat an ordinary purchased item as:

```text
فروش محصولات تولیدی
کالای ساخته‌شده
```

Explicit administrator-defined Sales Posting Rules remain authoritative.

## Below-Cost Sales

A legitimate sale can have:

```text
Revenue < COGS
```

when CR-24-01 allows or approves the sale.

Phase 25 must preserve the actual loss rather than rewriting inventory cost.

Gross margin:

```text
Gross Margin = Revenue - COGS
```

Negative gross margin is valid accounting evidence when the underlying sale was valid.

## Desktop Runtime

Phase 25 is wired into the actual Desktop runtime.

### Sales Invoice

```text
Finalize Sales Invoice
→ evaluate Sales Posting

Confirm Sales-origin Inventory Issue
→ valuation catch-up
→ evaluate Sales Posting
```

### Sales Return

```text
Finalize Sales Return
→ evaluate Sales Posting

Confirm Sales-origin Inventory Receipt
→ valuation catch-up
→ evaluate Sales Posting
```

Finalized documents created before this wiring can be caught up idempotently when opened if no Posting state exists.

## SQLite Persistence

Migration:

```text
0037_sales_posting.sql
```

Primary Sales Posting tables:

```text
sales_postings
sales_posting_rules
sales_posting_idempotency
sales_posting_journal_provenance
sales_posting_outbox
```

Idempotency and Journal provenance are append-only.

## Security and Audit

Dedicated permissions:

```text
sales.posting.view
sales.posting.execute
sales.posting.recover
sales.posting.trace.view
```

Operational trace preserves:

- actor;
- Company/Branch;
- Posting ID/version;
- Journal ID;
- request ID;
- operation ID;
- correlation ID;
- causation ID;
- source document/version;
- approval evidence when required.

Accounting still owns generic Journal lifecycle approval.

## Reconciliation

Canonical reconciliation is defined in:

[Sales Posting Reconciliation and Accounting Examples](../accounting/sales-posting-reconciliation.md)

At minimum, reconciliation verifies:

```text
Sales Grand Total
↔ A/R

Sales Tax Base
↔ Revenue

Sales Tax Amount
↔ Output VAT

Resolved Inventory Valuation
↔ COGS
↔ Inventory Relief

Sales Posting
↔ exactly one Journal Voucher
```

For Returns:

```text
Return commercial amount
↔ reversed Revenue / VAT / A/R

Return Valuation
↔ Inventory restoration / COGS reversal
```

## Step 28 Automated Integration Coverage

Step 28 protects:

- stock Sales;
- service-only Sales;
- mixed Sales;
- positive VAT;
- zero VAT;
- pending dependency recovery;
- historical Valuation rebuild;
- Moving Average to FIFO transition;
- Sales Return;
- Correction lineage;
- exact replay;
- CAS conflict;
- atomic rollback;
- Journal provenance;
- Desktop runtime wiring;
- fail-closed automatic account mapping.

## Argin Bridge Readiness

Phase 25 preserves the Argin Bridge principle:

```text
Desktop / SQLite
    ↓ future sync
Argin Bridge
    ↓
API / PostgreSQL
```

Business authority is not moved into local projections.

Durable IDs, source versions, request/operation identity, UTC metadata, immutable lineage, Idempotency and Outbox evidence remain explicit.

## Canonical References

- [Phase 25 Implementation Plan](phase-25-sales-posting-plan.md)
- [Sales Fulfillment and Posting Handoff](../architecture/sales-fulfillment-posting-handoff.md)
- [CR-24-01 Below-Cost Sales Policy](../architecture/cr-24-01-below-cost-sales-policy.md)
- [Sales Posting Reconciliation and Accounting Examples](../accounting/sales-posting-reconciliation.md)
- [Phase 24 Sales Workflow](phase-24-sales-workflow-plan.md)
- [Phase 21 Inventory Valuation](phase-21-inventory-valuation-plan.md)

## Remaining Closure

Only Step 30 remains:

```text
Quality Gate
→ owner validation evidence
→ merge
→ v0.25.0 release preparation/publication
```

The existence of tests is not evidence that they passed. Step 30 must record observed validation results.
