# Purchase Posting Argin Bridge Contract

## Status

Phase 23 Step 22 freezes the wire-neutral Argin Bridge contract for Purchase Posting.

This step does **not** implement transport, outbox workers, remote apply, acknowledgement storage, retry/backoff, .NET endpoints, PostgreSQL persistence or conflict-resolution UI.

Target direction:

```text
Argin Desktop
  -> SQLite
  -> Argin Bridge
  -> .NET API / PostgreSQL
  -> Synchronization
```

## Contract and Schema Versions

The contract exposes two explicit versions:

```text
contractVersion = 1
schemaVersion   = 1
```

Consumers must inspect both. Silent wire-shape changes are prohibited.

## Authoritative Envelope Families

Step 22 defines three envelope families:

1. `purchase-posting`
2. `purchase-posting-rule`
3. `purchase-posting-reversal`

The Accounting Journal itself is **not** copied into a Purchase Posting envelope.

Journal identity is transported only as an explicit dependency:

```text
{ entity: "journal-voucher", id: ... }
```

Accounting remains the Journal source of truth.

## Mandatory Metadata

Every envelope carries:

- contract version;
- schema version;
- operation ID;
- request ID;
- correlation ID;
- nullable causation ID;
- SHA-256 payload fingerprint;
- occurredAt;
- effectiveAt;
- changedAt;
- origin source system;
- optional source instance ID;
- nullable server revision.

All timestamps are canonical UTC ISO timestamps.

`occurredAt` and `effectiveAt` cannot be later than `changedAt`.

## Trace Semantics

The Step 4 trace contract remains authoritative.

Bridge does not invent a second request/operation model.

Self-causation is invalid:

```text
causationId != operationId
```

Transport retries may use separate network/request metadata later, but the financial operation trace remains durable.

## Purchase Posting Envelope

`PurchasePostingStateSyncEnvelope` carries:

- Company ID;
- Branch ID;
- durable Posting ID;
- local Posting version;
- full normalized Purchase Posting aggregate snapshot;
- durable Purchase source identity;
- source document type;
- source document ID;
- source version;
- nullable source revision;
- Posting purpose;
- canonical idempotency key;
- payload fingerprint;
- dependencies.

The financial source identity remains:

```text
Purchase Source
+ Source Version
+ Source Revision
+ Posting Purpose
```

The Bridge idempotency key is the exact Step 15 key; it is not recomputed from transport metadata.

Dependencies include:

- Branch;
- source Purchase document;
- linked Journal Voucher when present.

## Purchase Posting Rule Envelope

`PurchasePostingRuleSyncEnvelope` carries the Purchase-specific account-resolution rule plus:

- local optimistic version;
- createdAt;
- updatedAt;
- Company scope;
- nullable Branch scope.

Dependencies include:

- referenced Account;
- Branch when the rule is Branch-specific.

Rule synchronization does not synchronize Chart of Accounts itself.

## Reversal Envelope

`PurchasePostingReversalSyncEnvelope` is immutable revision 1 evidence.

It carries:

- Posting ID;
- original Journal Voucher ID;
- reversal Journal Voucher ID;
- reversal request ID;
- actor;
- reversedAt;
- reason;
- committed Posting version.

Dependencies include:

- Purchase Posting;
- original Journal;
- reversal Journal.

The original Journal and Posting histories are never replaced by a reversal envelope.

## No Tombstone for Financial History

Step 22 intentionally defines no tombstone envelope for Purchase Posting or Reversal lineage.

Posted/reversed accounting history is immutable historical evidence.

A remote receiver must not interpret reversal, correction or a later Posting version as deletion of an earlier financial fact.

Posting Rule lifecycle can be represented by its `active` flag and version rather than destructive synchronization deletion in this phase.

## Conflict Semantics

Future Bridge apply logic must preserve these rules:

- same source/version/revision/purpose + same fingerprint -> replay/acknowledge;
- same source/version/revision/purpose + different fingerprint -> conflict;
- lower/stale Posting or Rule version -> reject/defer according to apply policy;
- same immutable Reversal Posting with different lineage -> conflict;
- serverRevision never replaces local optimistic version;
- timestamps never authorize last-write-wins over financial history.

This step freezes the contract only; remote apply is outside Phase 23.

## Dependency Ordering

Logical dependency order is:

```text
Master Data
  -> Purchase Document
  -> Inventory / Valuation facts
  -> Purchase Posting Rule
  -> Purchase Posting
  -> Accounting Journal
  -> Purchase Posting Reversal lineage
```

Transport arrival order is not authority.

An apply adapter must defer an envelope whose durable dependencies are not yet resolvable.

## Argin Bridge Principle

The contract contains no:

- HTTP route;
- URL;
- authentication token;
- queue row ID;
- retry counter;
- backoff duration;
- socket state;
- online/offline flag;
- SQLite row identity.

Those belong to transport/infrastructure.

## Existing SQLite Readiness

Steps 20–21 already provide:

- durable TEXT identities;
- optimistic versions;
- `sync_origin`;
- nullable `server_revision`;
- nullable `sync_changed_at`;
- idempotency persistence;
- immutable reversal lineage;
- same-session transaction boundaries.

No additional migration is required solely to freeze Step 22's wire-neutral contract.

## Verification

Focused tests verify:

- contract/schema version;
- source version/revision preservation;
- deterministic idempotency key;
- Journal/Purchase dependency generation;
- Rule dependencies;
- immutable reversal dependencies;
- fingerprint validation;
- self-causation rejection;
- timestamp/snapshot ordering.
