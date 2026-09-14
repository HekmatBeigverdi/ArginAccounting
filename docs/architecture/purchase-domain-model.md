# Purchase Domain Model

## Status

Phase 22 Step 2 domain foundation. Persistence, pricing, lifecycle orchestration and downstream integration are intentionally deferred to their owning steps.

## Ownership

`@argin/purchase` owns persistence-neutral Purchase commercial aggregates. It does not own Inventory quantity movements, Inventory Valuation algorithms, accounting postings, Sales pricing or Treasury settlement.

## Aggregate Root

`PurchaseDocumentSnapshot` is the Phase 22 aggregate root foundation. Its durable identity is `documentId`; SQLite row identity, display numbers and future server-generated database keys must never replace this durable ID.

The Step 2 header contains only foundation facts needed before later semantics are introduced:

- `documentId`
- `companyId`
- `supplierId`
- `businessDate`
- optional description
- optional source reference
- optional correction reference
- ordered immutable lines
- optimistic version
- created/updated timestamps

Document type, lifecycle status, numbering/fiscal scope and Approval semantics belong to later fixed steps and are not guessed in Step 2.

## Lines

Every `PurchaseDocumentLineSnapshot` has a durable `lineId`, positive unique `position`, durable `itemId`, classification, optional description and optional source reference.

Step 2 freezes three line classifications:

- `stock-product`: Product line that may later link to Inventory receipt/movement and Valuation Cost Input.
- `non-stock-product`: Product line that is commercially purchased but does not create stock solely from the Purchase line itself.
- `service`: Service line and therefore never a stock line.

The classification invariant is structural:

- `stock-product` and `non-stock-product` require `itemType = product`;
- `service` requires `itemType = service`.

Step 2 does not decide exact quantity, unit conversion, price, currency, discount, charge or tax representation. Those semantics belong to Step 4.

## Source and Correction References

`PurchaseSourceReference` preserves external/import/upstream identity without coupling the aggregate to a persistence adapter. It consists of `sourceSystem`, `sourceDocumentId` and optional `sourceLineId`.

`PurchaseCorrectionReference` records a durable link to another Purchase document plus a required reason. Step 2 only defines the safe identity relationship; the actual correction/return workflow and compensation rules belong to Step 12.

A document cannot reference itself as its correction target. A Purchase source reference cannot identify the same Purchase document as its own upstream source.

## Invariants

The Step 2 aggregate enforces:

1. all durable identities are non-empty trimmed strings;
2. business date is a valid Gregorian `YYYY-MM-DD` value for internal storage;
3. timestamps are valid UTC ISO timestamps and `updatedAt >= createdAt`;
4. aggregate version is a positive safe integer;
5. line IDs are unique inside the document;
6. line positions are positive and unique inside the document;
7. Product/Service classification cannot contradict stock/non-stock/service line kind;
8. correction/source self-reference is rejected;
9. normalized snapshots and line collections are immutable/frozen;
10. rehydration executes the same invariants as creation.

These rules are persistence-neutral and must behave identically in SQLite Desktop and future PostgreSQL/.NET implementations.

## Argin Bridge Foundation

Step 2 establishes the durable identity subset needed by future Bridge envelopes:

- Purchase `documentId` and `lineId` survive store changes;
- `companyId`, `supplierId` and `itemId` are durable cross-module references rather than SQLite row IDs;
- external source and correction references are explicit durable facts;
- version/timestamps can later participate in optimistic concurrency and synchronization metadata;
- rehydration validates the same domain rules after serialization/transport.

Step 18 owns the complete versioned Argin Bridge synchronization envelope, request identity, tombstone and dependency semantics. Step 2 deliberately does not invent those transport contracts early.

## Deferred to Later Fixed Steps

- Step 3: supplier/Product/Service historical snapshots.
- Step 4: exact quantity, unit, currency, price, discounts, charges, taxes and rounding.
- Step 5: document types and lifecycle states/transitions.
- Step 6: Branch/fiscal scope and Number Series.
- Step 7: pricing/totals engine.
- Steps 8–12: receipt/invoice matching, Inventory/Valuation linkage and return/correction workflows.
- Steps 13–19: Application, persistence, idempotency/concurrency, Bridge, permission/Approval/Audit.

## Package Surface

Step 2 introduces `@argin/purchase` with a persistence-neutral public surface from `packages/purchase/src/index.ts`. No SQLite, Tauri, UI or accounting dependency is introduced by the domain foundation.
