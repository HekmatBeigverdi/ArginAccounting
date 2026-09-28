# Phase 23 Bridge, Replay, Rollback and Failure Acceptance

## Purpose

Phase 23 Step 34 verifies the failure and synchronization boundaries of the Purchase-to-Accounting workflow after the functional SQLite E2E path was proven in Step 33.

The acceptance focus is not another happy-path scenario. It verifies that authoritative financial facts remain stable under replay, partial failure, stale state and future Argin Bridge serialization.

## Bridge contract acceptance

Purchase Posting synchronization remains wire-neutral and versioned.

Step 34 adds regression coverage proving that a Posting envelope:

- survives JSON serialization without losing durable identity;
- preserves Company, Branch, Posting, Purchase source and Journal dependencies;
- preserves source version/revision;
- preserves the exact accounting-recognition idempotency identity;
- keeps local optimistic `localVersion` separate from nullable `serverRevision`;
- rejects cross-Company source/snapshot mismatches;
- rejects invalid chronology;
- never introduces a financial tombstone or last-write-wins deletion semantic.

Posting Rule and Reversal envelope behavior from Step 22 remains part of the same contract matrix.

Live network transport, acknowledgement, remote apply and conflict-resolution UI remain Phase 45 scope.

## Purchase source-cost rollback

Failure injection is applied inside Inventory's source-cost transaction while the FIFO layer is being created.

Expected result after the injected failure:

```text
Cost Input       = 0 rows
Valuation Entry  = 0 rows
FIFO Layer       = 0 rows
Stream Revision  = 0 rows
```

After the fault is removed, retry creates exactly one consistent Cost Input / Valuation / FIFO projection.

This proves that Purchase-derived valuation cannot leave a half-written monetary state.

## Posting rollback and recovery

Failure injection is applied at the final Posting idempotency-record write after Journal creation and Posting preparation have already been attempted inside the replay-safe transaction.

The expected durable state after failure is:

```text
Purchase Posting aggregate = draft / version 1
Journal Voucher            = absent
Posting idempotency        = absent
```

The draft Posting aggregate may exist because deterministic aggregate creation intentionally occurs before the atomic economic commit. It has no Journal link and no accounting effect.

After removing the injected failure, retry must:

1. reuse the deterministic Posting aggregate;
2. create one Journal;
3. prepare the Posting;
4. persist one idempotency record;
5. return exact replay on the next identical execution.

## Append-only replay evidence

The SQLite schema protects Purchase Posting idempotency rows with no-update and no-delete triggers.

Step 34 explicitly exercises both protections after a successful recovery. Replay evidence cannot be rewritten to point at another Posting version or removed after financial commit.

## CAS and stale state

The existing Purchase Posting repository and Domain/Application matrices remain authoritative for optimistic concurrency:

- repository updates use `WHERE ... version=?`;
- zero affected rows map to `purchase_posting.concurrency_conflict`;
- stale Purchase source versions are rejected before new Receipt staging;
- Posting replay identity does not bypass incompatible source/fingerprint state.

Step 34 treats these existing executable tests together with the new failure-injection tests as the phase CAS/replay acceptance boundary.

## Failure semantics

The integrated rules are:

- upstream confirmed Purchase facts are never silently rolled back by downstream accounting failure;
- failed Inventory monetary projection leaves no partial valuation facts;
- failed replay-safe Posting commit leaves no Journal or prepared Posting state;
- exact replay returns the existing durable result;
- incompatible replay fails closed;
- financial idempotency/reversal history is append-only;
- UI/in-memory locks remain convenience coordination, never synchronization authority.

## Argin Bridge authority

Synchronization-worthy facts remain:

- Purchase document/version and commercial facts;
- Inventory movement and authoritative Cost Input;
- valuation policy history;
- Purchase Posting aggregate/version;
- Accounting Journal identity owned by Accounting;
- immutable Posting reversal lineage;
- durable idempotency/replay evidence.

Rebuildable projections such as workflow labels, reconciliation presentation, FIFO report rows and UI next-action state are not Bridge authority.
