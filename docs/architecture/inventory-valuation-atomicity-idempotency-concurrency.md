# Inventory Valuation Atomicity, Idempotency and Optimistic Concurrency

Phase 21 Step 13 defines the mutation-safety boundary for Inventory Valuation. It builds on the Step 11 application contracts and Step 12 SQLite persistence without changing Phase 20 quantity authority.

## Transaction Boundary

`SqliteInventoryValuationUnitOfWork` delegates to the shared `DatabaseExecutor.transaction()` implementation. Desktop production uses the existing pinned SQLite connection path with `BEGIN IMMEDIATE`, `COMMIT` and `ROLLBACK`.

A valuation mutation must perform, on the same transaction session:

1. idempotency lookup,
2. movement/policy/cost-input reads,
3. expected stream revision check/advance,
4. valuation entry/layer/state writes,
5. idempotency outcome insert.

If any step fails, no subset is committed.

## Idempotency

Migration `0029_inventory_valuation_concurrency.sql` adds `inventory_valuation_idempotency` keyed by `(company_id, request_id)`.

A replay is valid only when the stored `operation` and `payload_fingerprint` exactly match the retry. Reusing a request ID with a different operation or fingerprint is a conflict. Successful retries return the durable recorded outcome instead of writing a second valuation result.

Fingerprint creation remains an application serialization concern; this step defines comparison and persistence semantics and does not introduce a second project-wide hashing standard.

## Optimistic Concurrency

`inventory_valuation_stream_versions` stores durable Company-scoped stream revisions.

Two stream families are defined:

- `policy:{companyId}` for Company valuation-policy mutation,
- `valuation:{companyId}:{productId}` for Product valuation/recalculation mutation across warehouses.

`advance(companyId, streamKey, expectedRevision)` is compare-and-swap:

- `expectedRevision = 0` creates revision `1` only when the stream does not yet exist.
- existing streams update with `WHERE revision = expectedRevision`.
- an update affecting anything other than exactly one row is a concurrency conflict.

This prevents two stale writers from both committing a policy transition or Product valuation replacement.

## Scope and Transfer Safety

Product valuation stream revision is Company + Product, not Warehouse. This matches Step 9 recalculation scope: transfers can propagate cost between warehouses, therefore simultaneous mutations to the same Product in different warehouses cannot be treated as independent monetary streams.

## Policy Race Protection

Company policy changes use the Company policy stream revision in addition to the Step 11 `expectedCurrentPolicyId` / `expectedCurrentRevision` command fields. Direct policy history remains append-only.

## Argin Bridge

The durable `requestId`, operation/fingerprint, stream key and revision are independent of SQLite row identity and are suitable for future server-side replay/conflict contracts. Live distributed transport and remote conflict reconciliation remain Phase 45; Step 14 defines the Phase 21 synchronization envelope.

## Deferred Validation

Step 13 adds focused contract/adapter tests. Real SQLite crash/restart/rollback, multi-connection races, migration upgrades and representative-scale concurrency validation remain Step 19.
