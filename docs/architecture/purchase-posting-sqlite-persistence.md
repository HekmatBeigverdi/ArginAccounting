# Purchase Posting SQLite Persistence

## Status

Phase 23 Step 20.

Migration `0033_purchase_posting.sql` establishes the durable SQLite persistence boundary for Purchase Posting.

## Migration Registration

Desktop registers:

```text
version: 33
description: purchase_posting
file: apps/desktop/src-tauri/migrations/0033_purchase_posting.sql
```

## Tables

### purchase_postings

Durable Purchase Posting aggregate state:

- posting ID;
- Company / Branch;
- Draft / Prepared / Posted / Reversed status;
- linked original Journal Voucher ID;
- optimistic version;
- timestamps;
- future Bridge sync metadata.

There is no SQLite-generated row identity.

A Draft row cannot carry a Journal link. Prepared/Posted/Reversed rows must carry one.

One Accounting Journal may belong to only one Purchase Posting.

### purchase_posting_rules

Persists the minimum Purchase-specific rule set introduced in Step 6.

Stored dimensions include:

- Company;
- optional Branch;
- optional event kind;
- optional line kind;
- account role;
- Account ID;
- priority;
- active flag;
- optimistic version;
- Bridge sync metadata.

The schema deliberately permits overlapping rule candidates because Step 6 owns ambiguity detection and rejects tied top matches explicitly.

### purchase_posting_idempotency

Append-only replay evidence for Step 15.

The durable identity stores:

- Company / Branch;
- source system/type/ID;
- source version/revision;
- posting purpose;
- SHA-256 payload fingerprint;
- Posting ID;
- Journal ID;
- committed Posting version/time.

A unique expression index over source identity + purpose prevents duplicate financial recognition even when `source_revision` is null.

UPDATE and DELETE are blocked by triggers.

### purchase_posting_reversals

Append-only Purchase Posting reversal lineage from Step 17:

- Posting ID;
- original Journal ID;
- reversal Journal ID;
- request ID;
- actor;
- time;
- reason;
- committed Posting version.

One Posting can have one reversal lineage and one reversal Journal cannot be reused.

UPDATE and DELETE are blocked by triggers.

## Foreign-Key Boundary

Purchase Posting references existing authoritative objects rather than copying them:

- Company;
- Branch;
- Account;
- Journal Voucher.

The migration does not mutate Purchase, Inventory, Valuation or Journal-owned tables.

## Optimistic Concurrency

`purchase_postings.version` and `purchase_posting_rules.version` are durable positive integers.

Step 21 repositories must perform compare-and-swap updates using the expected version and treat zero affected rows as a concurrency conflict.

## Bridge Compatibility

Authoritative identities are TEXT business IDs.

Bridge-oriented mutable tables carry:

- `sync_origin`;
- nullable `server_revision`;
- nullable `sync_changed_at`.

Idempotency and reversal rows are immutable historical evidence and are not given local row IDs.

## Index Policy

Indexes cover:

- Company/Branch/status posting lists;
- Journal-to-Posting lookup;
- rule resolution and Account use;
- source-to-Posting replay lookup;
- Journal replay lookup;
- reversal lineage;
- incremental Bridge scans for mutable Posting and Rule state.

## Validation

The Desktop migration contract test verifies:

- migration 33 registration;
- required tables;
- append-only triggers;
- replay/Bridge/CAS indexes;
- execution against a real in-memory SQLite prerequisite boundary.

Concrete repositories and Unit of Work are Step 21.
