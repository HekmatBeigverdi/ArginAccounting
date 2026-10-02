# Sales Argin Bridge Contract

Phase 24 Step 25 freezes the wire-neutral synchronization contract for authoritative Sales workflow facts.

```text
Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL
```

This step does **not** implement transport, remote acknowledgements, retry scheduling, conflict UI, server merge policy or live synchronization. Those remain owned by the later Argin Bridge phase.

## Contract version

`SALES_SYNC_CONTRACT_VERSION = 1`.

## Authoritative envelope

The Sales document upsert carries:

- durable Company, Branch and Sales document identity;
- display document number separately from identity;
- the validated Sales document snapshot, including durable line/source identities and commercial facts;
- lifecycle status;
- local optimistic `version`;
- the exact `requestId`, `operationId`, operation name and `payloadFingerprint` established by Phase 24 Step 22;
- actor, change timestamp and origin instance;
- optional server revision and external references;
- explicit dependencies for Branch, Fiscal Year, Customer Party, Products and related/source Sales documents/lines.

Bridge transport must not generate a second idempotency identity or reinterpret local optimistic versions.

## Tombstones

A tombstone represents synchronization deletion only. It is not a Sales lifecycle status.

Only a last-known `draft` may be represented as a Sales document tombstone by this Phase 24 contract. Submitted, approved, finalized or cancelled documents remain durable business facts and must use lifecycle/correction semantics rather than deletion.

## Ownership boundaries

Sales envelopes synchronize Sales authority only. Inventory Issue/Receipt and Inventory Valuation remain Inventory-owned facts and use their own Bridge contracts. Phase 25 accounting postings remain Accounting-owned facts.

Selling price is therefore not synchronized as Inventory cost, and Inventory cost is not embedded as a Sales commercial fact.

## Conflict readiness

The envelope preserves both controls needed by a future receiver:

1. mutation replay identity: `requestId + operationId + payloadFingerprint`;
2. aggregate concurrency identity: durable Sales document ID + `localVersion`.

The remote conflict/merge algorithm is deliberately not defined here.
