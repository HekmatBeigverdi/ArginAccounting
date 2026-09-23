# Controlled Posting Reversal

## Status

Phase 23 Step 17.

Step 17 defines controlled reversal for a Purchase Posting whose linked Accounting Journal has already been finally posted.

## Core Rule

Posted accounting history is immutable.

The original Journal and Purchase Posting are never edited to erase their effect.

Instead:

```text
Original Posted Journal
        ↓
Accounting Reversal Journal (new posted voucher)
        ↓
Purchase Posting status → reversed
        ↓
durable reversal lineage
```

## Accounting Ownership

Phase 23 does not duplicate Journal reversal logic.

It delegates reversal mechanics to the existing Accounting reversal contract, which already owns:

- reversing Debit/Credit lines;
- fiscal eligibility at reversal date;
- account/dimension validation;
- Journal optimistic concurrency;
- Journal reversal idempotency;
- original/reversal/replacement lineage.

Purchase Posting only coordinates that Accounting outcome with its own aggregate state.

## Preconditions

The current Purchase Posting must:

- exist in the requested Company;
- be `posted`;
- contain a durable original `journalVoucherId`;
- match `expectedPostingVersion`.

The Journal reversal must target exactly that linked Journal.

## Purchase Posting State

After a valid reversal:

```text
posted → reversed
```

The original `journalVoucherId` remains unchanged because it identifies the Journal that originally recognized the Purchase Posting.

The new reversal Journal ID is stored in a separate immutable `PurchasePostingReversalRecord`.

## Reversal Record

The record preserves:

- Posting ID;
- original Journal Voucher ID;
- reversal Journal Voucher ID;
- request ID;
- actor;
- timestamp;
- reason;
- committed Purchase Posting version.

This allows source-to-ledger lineage without overloading the aggregate's original Journal link.

## Atomic Boundary

The Step 17 Unit of Work contract requires the following to participate in one coordinated transaction boundary:

```text
Accounting Journal reversal
+
Purchase Posting posted→reversed transition
+
Purchase Posting reversal lineage
```

A storage adapter must not persist only one side.

Concrete SQLite coordination is implemented in Steps 20–21.

## Replay

A repeated reversal request with the same request ID and same Posting returns the stored reversal outcome and does not save the Purchase Posting again.

Reuse of the same request ID for another Posting fails with `reversal_conflict`.

Accounting's own reversal idempotency remains authoritative for Journal reversal replay.

## Concurrency

Purchase Posting uses `expectedPostingVersion`.

Accounting Journal reversal separately uses `expectedJournalVersion`.

Both must succeed.

## Replacement Journal

An optional replacement Journal may be passed through to Accounting's existing reversal contract.

Purchase Posting does not invent or mutate a replacement Journal.

## Non-Scope

- SQLite persistence — Steps 20–21;
- fiscal-period lock policy — Step 18;
- dimensions — Step 19;
- Bridge reversal transport — Step 22.
