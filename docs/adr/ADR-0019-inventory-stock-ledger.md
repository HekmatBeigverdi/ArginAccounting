# ADR-0019 — Append-only Inventory Stock Ledger and Rebuildable Balances

- Status: Accepted
- Date: 2026-09-08
- Phase: 20 — Inventory Documents
- Step: 6 — Stock Movement Ledger and Balance Rules

## Context

Inventory quantity must remain correct across offline operation, retries, backdated documents and future Argin Bridge synchronization. A mutable `on_hand` value by itself cannot explain history, recover from corruption, or safely resolve reordered facts. JavaScript floating-point arithmetic is also unsuitable for accounting-grade stock quantities.

Phase 20 Step 6 therefore needs a deterministic quantity source of truth before receipt/issue/opening/transfer workflows are implemented in Steps 7–8.

## Decision

1. Confirmed stock effects are represented as immutable `InventoryStockMovementSnapshot` facts with durable `movementId`, source document/line IDs, business date, UTC recording evidence, signed base-unit quantity and a durable StockKey.
2. `InventoryStockKey` is Company + Product + Warehouse + optional Zone + optional Location. Display codes/titles and database row positions are not identity.
3. Balances are projections rebuilt from movement facts. A stored balance may later be used as a transactional cache/projection, but never as the only authoritative quantity history.
4. Quantity arithmetic uses canonical decimal strings and BigInt coefficient arithmetic. JavaScript floating-point addition/subtraction is prohibited for stock balance calculation.
5. Canonical chronology is deterministic: `businessDate`, then durable `documentId`, `lineId`, and `movementId`. `recordedAt` is evidence and does not decide stock chronology.
6. Default policy rejects any ledger in which a StockKey becomes negative at any point in canonical history. Therefore a newly inserted backdated movement must revalidate historical running balances, not only the current ending balance.
7. A policy flag may explicitly permit negative stock for deployments that choose that behavior; permissive mode does not change canonical ordering or movement immutability.
8. Duplicate `movementId` is invalid. A document line cannot create the same StockKey fact twice; the same line may later create different StockKey facts where the owning workflow requires it (for example, transfer source/destination in Step 8).
9. Reversal does not delete or edit prior movements. Step 8 will emit compensating movement facts linked to the reversal lifecycle defined in Step 5.
10. Persistence, transaction locking, idempotency storage and atomic confirmation remain Steps 10–13. This ADR defines Domain truth, not a SQLite implementation.

## Consequences

- Kardex and balances can be rebuilt and reconciled from one durable fact stream.
- Backdated insertion can invalidate a transaction even when the final ending quantity would be non-negative; this is intentional under the default policy.
- Same-day ordering is stable across SQLite, PostgreSQL and Bridge replicas because it relies on durable identities rather than local insertion order.
- Movement history is append-only and suitable for future valuation consumption in Phase 21.
- Balance rebuilding has a computational cost; Step 13 may maintain transactional projections/indexes while preserving movement facts as the source of truth.
- Transfer conservation, opening uniqueness, receipt/issue semantics and reversal generation are not defined here; their owning Steps 7–8 remain unchanged.

## Rejected Alternatives

- Mutable balance only: rejected because it cannot reconstruct history or safely support replay/backdating.
- JavaScript `number`: rejected because decimal quantities such as `0.1 + 0.2` are not exact.
- Ordering by database sequence/rowid or `recordedAt`: rejected because local persistence/delivery order can differ between offline replicas.
- Silently permitting negative historical stock while checking only ending balance: rejected because it hides impossible historical stock states under the default policy.
