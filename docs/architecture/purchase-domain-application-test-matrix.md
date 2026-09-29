# Purchase Domain and Application Test Matrix

## Purpose

Phase 23 Step 32 formalizes the executable Domain/Application regression matrix for the Purchase-to-Accounting workflow introduced and extended through Steps 26–31.

This step deliberately stops short of the full SQLite/Desktop end-to-end acceptance gate owned by Step 33. Its responsibility is to prove deterministic domain decisions, Application replay/concurrency boundaries, and fail-closed accounting orchestration behavior.

## Domain coverage

### Fulfillment / accounting eligibility

Executable tests cover:

- stock invoice blocked with no receipt;
- stock invoice blocked with partial receipt;
- stock invoice eligible only after full receipt;
- service/non-stock lines requiring no Inventory receipt;
- mixed stock + service invoice behavior;
- accountant-approval mode;
- returned/corrected source blocking;
- inconsistent fulfillment declarations;
- duplicate Purchase line identity rejection;
- immutable eligibility snapshots.

### Purchase Matching Engine

Executable tests cover:

- deterministic two-way matching across multiple partial receipts;
- deterministic proposal order independent of receipt input order;
- existing match preservation;
- exact remaining-quantity calculation;
- fractional base quantity matching;
- duplicate invoice-line identity rejection;
- product mismatch rejection;
- already-overmatched facts rejection;
- three-way Purchase Order quantity variance;
- price variance in basis points;
- tolerance boundary acceptance;
- one-basis-point-outside-tolerance rejection;
- invalid tolerance rejection.

### Purchase Posting orchestration

Executable tests cover:

- blocked eligibility stopping before Posting dependencies are touched;
- accountant-approval mode stopping before Journal generation;
- automatic/approval eligibility mismatch failing closed;
- normal service invoice automatic Journal generation;
- rule-driven debit/credit resolution;
- replay-safe Journal commit;
- exact replay returning one committed result;
- incompatible payload fingerprint conflict;
- stale Posting version conflict;
- atomic rollback when Journal/Posting persistence fails.

## Application coverage

Purchase Application tests already validate durable replay behavior for:

- Purchase lifecycle mutations;
- Inventory receipt staging;
- Receipt/Invoice matching;
- Inventory valuation cost resolution.

Step 32 additionally updates Desktop/Application integration fixtures for the Step 31 hardened Receipt command signature and adds an explicit same-submission replay test:

```text
same open receipt form
    ↓
same submissionId
    ↓
same request / Inventory document identity
    ↓
one Inventory draft
```

A newly opened receipt form uses a new submission ID and can create the next legitimate partial Receipt.

## Failure philosophy

Every tested workflow follows fail-closed rules:

- invalid or stale facts do not silently produce accounting effects;
- variance does not become matched merely because receipt quantity is complete;
- duplicate/replayed requests do not intentionally duplicate durable facts;
- missing/incompatible Posting prerequisites do not mutate the confirmed Purchase source;
- downstream failure is retryable from durable state.

## Test ownership boundary

Step 32: pure Domain and Application-level behavior plus focused Application integration regression.

Step 33: full SQLite Purchase/Inventory/Valuation/Posting/Accounting end-to-end scenarios.

Step 34: Bridge, replay, rollback, concurrency and failure-injection acceptance across persistence/synchronization boundaries.

## Argin Bridge

Domain tests verify deterministic rebuildable decisions. Application tests verify stable durable identities and replay contracts.

No UI-only status, in-memory workflow lock or transient submission promise is treated as Bridge synchronization authority.
