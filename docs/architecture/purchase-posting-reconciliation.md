# Purchase-to-Ledger Reconciliation

## Status

Phase 23 Step 24.

Step 24 adds a read-only reconciliation boundary across:

```text
Purchase Source
  -> Purchase Posting
  -> Accounting Journal Voucher
  -> Journal Lines
  -> optional Reversal Lineage
```

The reader does not mutate Purchase, Inventory, Valuation or Accounting state.

## Forward Lookup

`PurchasePostingReconciliationReader.findBySource(...)` resolves one or more Posting outcomes for a durable Purchase source identity:

- Company;
- Purchase document type;
- Purchase document ID;
- source version;
- optional source revision.

The durable source mapping is read from Step 15 idempotency evidence.

## Reverse Lookup

The reader supports reverse drill-down from:

- Purchase Posting ID;
- Journal Voucher ID;
- Journal Line ID.

A Journal Line is first resolved to its owning Journal Voucher and then through the Purchase Posting linkage back to the Purchase source.

Reversal Journal IDs are also recognized through immutable Step 17 reversal lineage.

## Snapshot

The reconciliation snapshot contains:

- durable Purchase source identity;
- Purchase Posting aggregate;
- Accounting Journal Voucher including Journal Lines and dimensions;
- optional Purchase Posting reversal lineage;
- optional Reversal Journal Voucher;
- deterministic reconciliation issues;
- final `reconciled` boolean.

## Reconciliation Rules

The evaluator reports these issue codes:

- `posting-missing`
- `journal-missing`
- `source-mismatch`
- `company-mismatch`
- `branch-mismatch`
- `journal-unbalanced`
- `posting-state-mismatch`
- `reversal-lineage-missing`
- `reversal-journal-missing`
- `reversal-journal-invalid`

## Lifecycle Alignment

The following lifecycle pairs are expected:

```text
Purchase Posting prepared
  <-> Accounting Journal draft

Purchase Posting posted
  <-> Accounting Journal posted

Purchase Posting reversed
  <-> Original Accounting Journal reversed
      + Reversal Accounting Journal posted
```

A mismatch is diagnostic evidence and does not silently repair either side.

## Source Integrity

The Accounting Journal must retain:

```text
source.type = source_document
source.sourceId = Purchase source document ID
```

Company and Branch must match the durable Purchase Posting source scope.

## Balance

The Accounting Journal must remain balanced:

```text
totalDebit == totalCredit
currency matches
```

Step 24 does not recompute Purchase commercial pricing, tax, FIFO or Moving Weighted Average.

Commercial and valuation authority remains in Phases 21–22.

## Reversal Integrity

A Reversed Purchase Posting requires:

- durable reversal lineage;
- original Journal ID matching the Purchase Posting Journal link;
- durable Reversal Journal;
- Reversal Journal Company match;
- posted Reversal Journal state;
- balanced Reversal Journal.

## SQLite Reader

`SqlitePurchasePostingReconciliationReader` uses existing authoritative tables:

- `purchase_posting_idempotency`
- `purchase_postings`
- `purchase_posting_reversals`
- `journal_vouchers`
- `journal_lines`
- `journal_line_dimension_assignments`

No projection table or new migration is required.

The reader is also exposed from `SqlitePurchasePostingUnitOfWork` so a caller may run reconciliation on the same transaction/session boundary when needed.

## Security

Step 23 remains the authorization boundary.

The reconciliation reader is a low-level read adapter; Desktop/Application callers must use the secured Posting view/trace permissions before exposing reconciliation data.

## Argin Bridge

Reconciliation is rebuildable/read-only evidence.

It is not an independently synchronized source of truth.

Bridge continues to synchronize durable Posting/Rule/Reversal facts from Step 22 rather than reconciliation projections.

## Tests

Focused tests cover:

- healthy Posting/Journal reconciliation;
- missing Posting/Journal diagnostics;
- source/Branch mismatch;
- reversed Posting lineage requirement;
- durable source lookup SQL;
- Journal Line -> Journal reverse lookup;
- Reversal Journal -> Posting reverse lookup.

## Non-Scope

- Desktop reconciliation UI — Step 25;
- bulk reconciliation reports/exports — later reporting scope;
- remote Bridge reconciliation — synchronization phase;
- rewriting or repairing accounting history.
