# Version and Concurrency Control

## Status

Phase 23 Step 16.

Step 16 formalizes optimistic concurrency for Purchase Posting mutations.

## Core Rule

A caller-provided Purchase Posting snapshot is never trusted as the final write authority.

For every first execution:

```text
BEGIN TRANSACTION
  load current Purchase Posting
  compare current.version with expectedVersion
  validate state/scope
  apply transition
  persist with compare-and-swap expectedVersion
COMMIT
```

The current aggregate is loaded inside the same Unit of Work that performs persistence.

## Optimistic Concurrency

The mutation requires durable Posting ID, Company, Branch and caller `expectedPostingVersion`.

If `current.version != expectedPostingVersion`, the operation fails with `purchase_posting.concurrency_conflict`.

No silent overwrite or last-write-wins behavior is permitted.

## State Concurrency

The Draft-to-Prepared mutation also requires the currently loaded Posting to still be `status = draft` and `journalVoucherId = null`.

If another operation already prepared/posted/reversed the Posting, the stale mutation fails with `purchase_posting.concurrency_state_mismatch`.

## Scope

The current Posting must still match the expected Company, Branch and Posting ID. Scope mismatch is treated as a concurrency/state integrity failure rather than being silently corrected.

## Journal Version

A newly created Journal Draft in this workflow must begin at `version = 1` and `status = draft`.

A reused or already-mutated Journal object is rejected with `purchase_posting.journal_version_conflict`.

Later Journal lifecycle concurrency remains owned by Accounting.

## Replay Ordering

Exact idempotent replay from Step 15 is intentionally checked before current Posting version validation.

Therefore an exact replay of an already committed request still returns the original outcome even if the Posting aggregate has advanced after that commit.

This prevents retries from being misclassified as concurrency conflicts.

## Atomic Path

Both mutation entry points now load the current Posting inside their Unit of Work:

- `commitPurchasePostingJournalDraftAtomically`
- `commitPurchasePostingReplaySafe`

Both transition from the loaded current aggregate, not from the caller snapshot.

## Persistence Requirement

Concrete repository adapters in Steps 20–21 must implement compare-and-swap persistence equivalent to:

```sql
UPDATE purchase_postings
SET ...
WHERE posting_id = ?
  AND version = ?
```

and must treat zero affected rows as an optimistic concurrency conflict.

## Argin Bridge

Concurrency uses durable aggregate version, not SQLite row identity. Future Bridge/server implementations must preserve the same expected-version semantics.

## Non-Scope

- final SQLite repository implementation — Steps 20–21;
- Journal final-post lifecycle concurrency — Accounting-owned;
- reversal concurrency — Step 17;
- fiscal locking — Step 18.
