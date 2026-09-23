# Purchase Posting SQLite Repository, Readers and Unit of Work

## Status

Phase 23 Step 21.

Step 21 implements the concrete SQLite adapter package:

```text
@argin/purchase-posting-tauri
```

The Domain/Application package `@argin/purchase-posting` remains persistence-neutral.

## Repositories

### SqlitePurchasePostingRepository

Owns durable aggregate persistence for `purchase_postings`.

Capabilities:

- find by durable Posting ID;
- insert new aggregate;
- compare-and-swap update using `posting_id + company_id + expectedVersion`.

A zero-row CAS update raises the stable Purchase Posting concurrency conflict.

### SqlitePurchasePostingRuleRepository

Persists and reads the Step 6 Purchase-specific account-resolution rules.

Active rules are returned in deterministic role / priority / rule-ID order.

Rule updates use optimistic expected-version CAS.

### SqlitePurchasePostingIdempotencyRepository

Reads and appends Step 15 replay records.

It does not update/delete replay evidence.

The SQLite migration enforces append-only behavior and source identity uniqueness.

### SqlitePurchasePostingReversalRepository

Reads reversal lineage by Company/request ID and appends the Step 17 durable reversal record.

The migration owns append-only and uniqueness constraints.

## Readers

### Account Reader

`SqlitePurchasePostingAccountReader` reads the minimum Account snapshot required by Step 6:

- Account ID;
- Company;
- code/name;
- status;
- postingAllowed.

### Fiscal Reader

`SqlitePurchasePostingFiscalReader` resolves the Fiscal Year and Fiscal Period containing an operation date and reads active Historical Locks.

It supplies the Step 18 contracts without copying fiscal authority into Purchase Posting.

### Dimension Reader

`SqlitePurchasePostingDimensionReader` reads:

- Account Dimension Policies;
- Dimension Types;
- Dimension Members;
- source-reference member mappings.

Source → Dimension Type mapping is configurable through `PurchasePostingDimensionTypeIdMap`.

This is intentional: Phase 11 allows company-defined analytical dimensions, so the adapter does not hard-code hidden codes such as PARTY or WAREHOUSE.

## Generic Unit of Work

`SqlitePurchasePostingUnitOfWork` calls:

```text
DatabaseExecutor.transaction(...)
```

and exposes all Purchase Posting repositories/readers plus the canonical Accounting Journal repository on the same transaction-bound `DatabaseSession`.

Desktop production therefore inherits the existing database guarantee:

```text
BEGIN IMMEDIATE
  all callback reads/writes on one pinned SQLite connection
COMMIT
or
ROLLBACK
```

## Application-Specific Unit of Work Adapters

Step 21 supplies adapters for the contracts introduced earlier in Phase 23:

- `SqlitePurchasePostingAtomicUnitOfWork`
- `SqlitePurchasePostingReplayUnitOfWork`
- `SqlitePurchasePostingReversalUnitOfWork`

### Atomic / Replay

Journal creation, Purchase Posting CAS update, fiscal reads and replay evidence all use the same transaction session.

This closes the application-level read/check/write gap described in Steps 14–16.

### Reversal

The reversal UoW accepts a `PurchasePostingJournalReverser` callback:

```text
(DatabaseSession, ReverseJournalVoucherCommand)
  -> JournalVoucherReversalResult
```

The callback receives the exact active Purchase Posting transaction session.

This allows Desktop composition to execute the canonical Accounting reversal logic against the same session without opening a nested transaction.

After the Accounting reversal succeeds, the same transaction:

- CAS-updates Purchase Posting to Reversed;
- appends Purchase Posting reversal lineage.

## Argin Bridge

Repositories use durable TEXT identities and optimistic versions only.

No adapter API exposes SQLite row IDs as business identity.

Mutable Posting/Rule rows retain Step 20 Bridge metadata; replay/reversal evidence remains immutable.

## Tests

`packages/purchase-posting-tauri/tests/sqlite-purchase-posting.test.ts` covers:

- aggregate rehydration;
- CAS SQL shape;
- stale CAS conflict;
- one-session generic UoW;
- replay reads on the same transaction;
- reversal lineage insert;
- exact transaction-session handoff to the Accounting reversal callback.

## Non-Scope

- Bridge envelope/transport — Step 22;
- security/audit — Step 23;
- reconciliation readers — Step 24;
- Desktop Posting UI — Step 25.
