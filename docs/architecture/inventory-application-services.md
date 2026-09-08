# Inventory Application Services, Idempotency, and Concurrency

Phase 20 Step 10 composes the persistence-neutral contracts from Step 9 with the lifecycle, scope, stock, transfer, adjustment, and reversal workflows from Steps 4–8.

## Authoritative Mutation Boundary

`InventoryApplicationService` executes every stock-changing operation through one `InventoryUnitOfWork.execute(...)` callback. Inside that boundary it performs, in order:

1. Company-scoped idempotency lookup.
2. Durable document reload.
3. `expectedVersion` comparison.
4. Current scope/master validation.
5. Authoritative movement reads for all affected StockKeys.
6. Durable `businessOrder` allocation inside the UoW.
7. Receipt/issue/opening/transfer/adjustment/reversal workflow execution.
8. Movement append and balance-projection replacement.
9. Opening-key persistence when applicable.
10. Document version/state update.
11. Idempotency outcome persistence.

The concrete SQLite transaction and rollback implementation remains Step 13.

## Idempotency

Idempotency identity is scoped by Company + `requestKey`.

- First successful execution stores operation, canonical payload fingerprint, outcome kind, durable document identity, resulting document version/status, and UTC record time.
- Repeating the same key with the same operation and fingerprint returns the recorded outcome without producing another stock movement.
- Reusing the same key with a different operation or fingerprint raises `inventory.application.idempotency-conflict`.
- Replay does not depend on the document's later lifecycle state because the successful outcome status/version are stored in the idempotency record.

Database uniqueness and restart durability are implemented by Steps 11 and 13.

## Optimistic Concurrency

Every lifecycle/confirmation/reversal mutation reloads the document inside the UoW and compares its current version with `expectedVersion`. A stale caller receives `inventory.application.concurrency-conflict` before stock writes.

Document optimistic concurrency is necessary but not sufficient for inventory. Two different Issue/Adjustment documents may have unrelated versions while competing for the same stock. Therefore stock-changing services also reload authoritative movement facts for every affected StockKey inside the same UoW and rebuild the quantity ledger before accepting the candidate movement batch.

The UoW contract requires implementations to serialize conflicting StockKey mutation transactions or surface an optimistic/serialization conflict. Step 13 supplies the concrete SQLite behavior.

## Business Ordering

Callers cannot supply `businessOrder`. `InventoryBusinessOrderRepository.next(companyId, businessDate)` is invoked inside the UoW so same-day stock chronology cannot be forged by a UI/import/source module and cannot race independently from the committing mutation.

## Numbering

Submission may call the injected `InventoryNumberingGateway` when a document has no display number. Number assignment participates in the same Application mutation boundary. Shared Number Series implementation remains the authoritative provider; display number is never durable identity.

## Reversal Date

Reversal carries its own `businessDate`. The Application service validates that date against current fiscal scope/historical locks before allocating a business order and generating append-only compensating movement facts. The original confirmed document's business date is never rewritten.

## Argin Bridge Preparation

The service preserves durable document, movement, transfer, reversal, request, and fingerprint identities. Future Bridge replay must use the same idempotency semantics and must never synchronize balance projections as independent authoritative facts. Step 12 freezes the versioned Bridge envelopes; live transport remains outside Phase 20.

## Boundaries

Step 10 does not add SQL, migrations, SQLite adapters, Tauri commands, HTTP endpoints, permissions, Audit integration, or live synchronization. Those remain in their frozen owning steps.
