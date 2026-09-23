# Idempotency and Replay Safety

## Status

Phase 23 Step 15.

Step 15 makes Purchase Posting safe against duplicate execution, retries, double-clicks and replay after transient failures.

## Identity

The final idempotency identity is:

```text
durable source identity
+ source version
+ source revision
+ posting purpose
```

The canonical key is derived from the Step 4 source identity plus:

```text
purpose = accounting-recognition
```

Payload fingerprint is stored alongside that key and is used to distinguish an exact replay from incompatible reuse.

## Payload Fingerprint

Step 15 requires a lowercase SHA-256 fingerprint encoded as exactly 64 hexadecimal characters.

The fingerprint represents the deterministic posting payload/facts used by the caller.

Step 15 does not trust `requestId` as financial idempotency identity because a retry may arrive under different transport/request metadata.

## Exact Replay

When the same:

- source identity;
- source version/revision;
- purpose;
- payload fingerprint;

is received again, no new Journal or Purchase Posting is written.

The existing committed:

- prepared Purchase Posting;
- Journal Voucher;
- idempotency record;

is loaded and returned with:

```text
replayed = true
```

## Conflict

If the same source/version/revision/purpose is reused with a different payload fingerprint:

```text
purchase_posting.idempotency_conflict
```

is raised.

A second Journal must not be created.

## New Version

A new source version or revision produces a different idempotency key and is therefore a distinct posting attempt.

This is required for controlled corrections/revisions while preserving previous immutable outcomes.

## Atomic Persistence

For a first execution, the following belong to one Unit of Work:

```text
create Journal Draft
save prepared Purchase Posting
save Idempotency Record
```

All three commit together or all three roll back.

Replay lookup occurs inside that same transaction boundary to support a later SQLite unique constraint without creating a check-then-write gap.

## Stored Outcome Integrity

Replay does not merely return an ID from the idempotency table.

It verifies that:

- prepared Posting still exists;
- Journal still exists;
- Posting points to that Journal;
- committed Posting version matches the recorded version.

Missing/inconsistent outcome produces `replay_outcome_invalid`.

## Argin Bridge

The idempotency record contains only durable identities:

- source identity/version/revision;
- purpose;
- payload fingerprint;
- Posting ID;
- Journal Voucher ID;
- committed Posting version;
- committed timestamp.

SQLite row IDs are never part of replay identity.

## Non-Scope

- database unique constraints / SQLite repository implementation — Steps 20–21;
- generalized optimistic concurrency policy — Step 16;
- reversal identity — Step 17;
- Bridge transport — Step 22.
