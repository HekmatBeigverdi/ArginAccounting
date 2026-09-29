# Draft Journal Generation and Balancing

## Status

Phase 23 Step 13.

Step 13 is the boundary where fully resolved Purchase Posting components become a real Accounting `JournalVoucher` in `draft` status.

It does not persist or post the voucher.

## Input Gate

Only fully resolved components can enter draft generation.

Any component with:

- `amount = null`; or
- a remaining `deferredToStep`

is rejected before Accounting is called.

This prevents partially valued Purchase facts from producing incomplete journals.

## Supplier Invoice Composition

Step 13 composes the Supplier Invoice draft from:

- Step 7 principal/payable semantics;
- Step 8 tax routing;
- Step 9 charge routing;
- Step 12 authoritative stock valuation.

Raw Step 7 deferred tax/charge placeholders are not journal lines.

Stock `chargeAmount` already included in Phase 22 Cost Input / Step 12 valuation is not posted a second time.

A deferred stock non-recoverable VAT component is likewise not duplicated as a separate line; the final balance gate proves whether the authoritative Inventory valuation includes the required capitalized amount.

## Account Resolution

Every effective component is resolved through the Step 6 Posting Rule engine.

Resolution context includes:

- Company;
- Branch;
- posting event kind;
- Purchase line kind when applicable;
- account role.

No account ID is hard-coded by Step 13.

## Balance Gate

Before constructing the Accounting voucher:

```text
sum(Debit) == sum(Credit)
```

must hold exactly as safe integer money.

If not, Step 13 fails with `draft_journal_unbalanced`.

There is no suspense account and no automatic balancing line.

Accounting's own `createJournalVoucher` validation runs after the Purchase-specific balance gate, providing a second invariant boundary.

## Accounting Ownership

The resulting object is created by `@argin/accounting/journal` and therefore uses the canonical Accounting model:

- status = `draft`;
- Company / Branch;
- Fiscal Year / Period;
- voucher date;
- currency;
- balanced Journal Lines;
- source-document provenance;
- immutable totals.

Step 13 does not write Journal tables directly.

## Source Trace

The Journal source is:

```text
type = source_document
sourceId = Purchase document ID
requestId = Purchase Posting request ID
correlationId = Purchase Posting correlation ID
causationId = Purchase Posting causation ID
```

The Purchase Posting `operationId` remains part of Posting provenance and is not overloaded into an Accounting field that has different semantics.

## Deterministic Lines

The caller supplies one durable Journal Line ID for every effective component.

Step 13 preserves deterministic component order and assigns canonical Journal line order `1..N`.

Dimensions remain empty here and are resolved in Step 19.

## Non-Scope

- persistence / transaction commit — Step 14
- idempotency / replay — Step 15
- concurrency — Step 16
- fiscal lock enforcement — Step 18
- accounting dimensions — Step 19
