# Atomic Journal Posting

## Status

Phase 23 Step 14.

Step 14 defines the transaction boundary that commits the Accounting Draft Journal and the Purchase Posting linkage as one indivisible operation.

## Important Lifecycle Boundary

"Atomic Journal Posting" in Phase 23 does **not** bypass the existing Accounting approval lifecycle.

Step 13 creates an Accounting `JournalVoucher` with:

```text
status = draft
```

Step 14 atomically persists that Draft Journal and moves the Purchase Posting aggregate from:

```text
draft → prepared
```

with the durable `journalVoucherId`.

The Accounting Journal remains Draft until the canonical Accounting lifecycle submits, approves and finally posts it.

## Atomic Invariant

The required multi-write operation is:

```text
BEGIN TRANSACTION

  create Accounting Journal draft
  save Purchase Posting as prepared + journalVoucherId

COMMIT
```

If either write fails:

```text
ROLLBACK
```

No orphan Journal and no prepared Purchase Posting without its Journal may survive.

## Purchase Posting State

Step 14 clarifies the aggregate invariant:

- `draft` → no Journal link;
- `prepared` → Journal link required;
- `posted` → Journal link required;
- `reversed` → Journal link required.

The new `preparePurchasePosting` transition:

- only accepts `draft`;
- requires optimistic `expectedVersion`;
- requires a durable Journal Voucher ID;
- increments aggregate version;
- records canonical `updatedAt`.

## Pre-Transaction Validation

Before entering the Unit of Work, Step 14 validates:

- Journal status is `draft`;
- Company and Branch match Purchase Posting;
- Journal source is `source_document`;
- Journal has a durable source ID;
- Journal remains balanced with at least two effective lines;
- expected Purchase Posting version matches.

## Transaction Contract

Step 14 introduces a persistence-neutral Unit of Work contract:

```text
PurchasePostingAtomicUnitOfWork
  └─ run(session)
       ├─ createJournalDraft(...)
       └─ savePreparedPosting(..., expectedVersion)
```

The concrete SQLite implementation is intentionally deferred to Steps 20–21.

That adapter must bind both operations to the **same database transaction/session**.

## Failure Semantics

The Unit of Work callback returning successfully is the only commit signal.

Any exception from:

- Journal persistence;
- Purchase Posting optimistic update;
- database constraint;
- transaction commit;

must abort the operation.

The application layer must not catch an inner write failure and continue with the second write.

## Argin Bridge

The atomic boundary uses durable Journal and Purchase Posting IDs. It does not depend on SQLite row IDs.

Future server/Bridge implementations must preserve the same all-or-nothing semantic even when the storage technology changes.

## Non-Scope

- idempotency/replay identity — Step 15;
- general concurrency policy — Step 16;
- final Journal reversal — Step 17;
- fiscal locks — Step 18;
- SQLite repositories/UoW implementation — Steps 20–21.
