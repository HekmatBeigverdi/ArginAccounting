# Inventory Argin Bridge and Future Synchronization Contract

## Status

Phase 20 Step 12 freezes the synchronization-facing contract for Inventory documents and immutable quantity movements. It does not implement transport, outbox processing, remote APIs, PostgreSQL persistence, acknowledgement, retry/backoff, conflict-resolution UI or server-authority policy.

## Target Direction

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

## Contract Version

The current wire-neutral contract version is `1`. Consumers must branch on `contractVersion`; silent shape changes are prohibited.

## Durable Identity

Cross-store identity uses durable text IDs only:

- Company: `companyId`
- Inventory document: `documentId`
- Inventory line: `lineId`
- Movement fact: `movementId`
- Transfer group: `transferId`
- Reversal compensation group/effect identity: `effectDocumentId`
- Original fact neutralized by reversal: `reversalOfMovementId`

Display document numbers, Product/Warehouse codes, SQLite row positions and arrival order are never synchronization identity.

## Two Envelope Families

### Inventory Document

`InventoryDocumentSyncEnvelope` is a discriminated union:

- `upsert` carries the complete immutable Application snapshot plus local optimistic version.
- `tombstone` carries durable identity, version and deletion timestamp with `snapshot: null`.

Only Draft documents may produce tombstones. `cancelled`, `confirmed` and `reversed` are business lifecycle states, not deletions.

### Inventory Movement Batch

`InventoryMovementBatchSyncEnvelope` carries immutable movement facts as one atomic synchronization unit.

Batch kinds:

- `confirmation` — ordinary receipt/issue/opening/adjustment facts.
- `transfer` — every source/destination fact belonging to one durable transfer identity.
- `reversal` — all compensating facts produced by one reversal operation.

There is intentionally no balance synchronization envelope. `inventory_stock_balances` is a local rebuildable projection; accepted movement facts are authoritative.

## Mandatory Metadata

Every envelope carries:

- `contractVersion`
- `operationId`
- `requestId`
- `idempotencyKey`
- `payloadFingerprint`
- `changedAt` in canonical UTC
- origin (`sourceSystem`, optional `sourceInstanceId`)
- optional synchronization external references
- positive local version
- optional positive `serverRevision`

`operationId`, request identity and idempotency identity are not inferred from mutable document fields or timestamps.

## Local Version vs Server Revision

`localVersion` is the optimistic version of the owning Inventory document at the successful local mutation boundary.

`serverRevision` is optional synchronization acknowledgement/canonical-server metadata. It may be null before a remote acknowledgement and must never overwrite or masquerade as the local optimistic version.

Step 12 does not define which side wins a future editable-document conflict. Confirmed movement facts are different: they are immutable and are never merged through last-write-wins.

## Idempotency and Payload Fingerprint

A retried logical change keeps the same idempotency identity and payload fingerprint.

Expected future apply semantics:

- same idempotency identity + same fingerprint -> replay/acknowledge the already accepted result;
- same idempotency identity + different fingerprint -> conflict;
- same immutable movement ID under a different batch -> conflict;
- receipt of an already accepted transfer/reversal batch -> no second stock effect.

The contract does not implement storage or transport replay; local durable request persistence is prepared by Phase 20 and concrete SQLite composition belongs to Step 13.

## Atomic Transfer Rule

A Transfer batch is valid only when:

- every fact has the same `transferId` equal to the batch identity;
- source and destination facts are present together for every line;
- source and destination StockKeys are distinct;
- exact signed quantities sum to zero for every line;
- no movement in the batch is a reversal fact.

Argin Bridge and future APIs must not acknowledge or apply only one side of a transfer.

## Atomic Reversal Rule

A Reversal batch:

- uses an effect/group identity distinct from the original owning document;
- contains only facts with `reversalOfMovementId`;
- contains each referenced original movement at most once;
- depends on the original document and all original movement facts it neutralizes.

A receiver must not apply compensating facts before their original facts are known. It must not apply only a subset of the reversal batch.

## Dependency Ordering

Each movement batch explicitly exposes dependencies:

- every batch depends on its owning Inventory document;
- a reversal batch additionally depends on every original movement it compensates.

Product, Warehouse, Zone and Location durable references remain upstream master-data dependencies. A future synchronization engine must ensure those masters are resolvable before accepting Inventory facts; this contract does not duplicate their master snapshots.

## Business Chronology

Synchronization delivery order is not Inventory business order.

Stock chronology remains:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`

`changedAt`, server arrival time, queue order, HTTP order and SQLite row order must not replace this chronology. Backdated facts therefore remain meaningful even when synchronized later.

## No Last-Write-Wins for Confirmed Facts

Confirmed movements are append-only facts. Remote reconciliation must never:

- mutate quantity of an existing movement;
- replace a movement because another copy has a newer timestamp;
- delete an original movement after reversal;
- independently synchronize an editable stock balance;
- split Transfer/Reversal batches.

Corrections are new linked facts.

## Reversal Persistence Handoff

The current Application model uses `ownerDocumentId` for the original lifecycle aggregate and a distinct `effectDocumentId` for the compensating movement group. Step 11 SQLite schema currently assumes movement document/line relational ownership more strictly than this reversal representation.

Step 13 is blocked from claiming persistence completion until this is reconciled explicitly: either persistence supports the conditional reversal relationship, or the application creates a first-class persisted reversal aggregate atomically. Step 12 deliberately preserves both durable identities so that this persistence choice will not require a Bridge contract break.

## Adapter Boundary

Future adapters may project the contract to:

- SQLite change readers/writers;
- Argin Bridge transport;
- .NET application/API endpoints;
- PostgreSQL persistence;
- background synchronization jobs.

The canonical contract contains no HTTP URL/method, retry counter, queue row ID, socket state, connection configuration, online/offline flag or network error.

## Deferred Scope

Phase 20 Step 12 does not implement:

- outbox tables or workers;
- polling/change-feed scheduling;
- push/pull networking;
- acknowledgement persistence;
- retry/backoff;
- checkpoints;
- PostgreSQL/.NET adapters;
- editable-document conflict winner selection;
- merge UI;
- live Argin Bridge process management.

Those remain dedicated synchronization/infrastructure responsibilities.
