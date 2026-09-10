# Inventory Transfer, Adjustment, and Reversal Workflows

## Scope

Phase 20 Step 8 defines persistence-neutral stock semantics for Inventory transfers, signed quantity adjustments, and append-only compensation of confirmed stock facts. It builds on the lifecycle, scope, exact quantity, and stock-ledger rules delivered in Steps 3–7.

This step does not add repositories, SQLite transactions, durable idempotency, optimistic locking, or Argin Bridge transport. Those remain in Steps 9–13.

## Transfer Contract

A transfer document must be `approved`, structurally complete, and pass the existing confirmation-time Company/Branch/fiscal/lock/Warehouse visibility checks. Current Product and both physical endpoints are revalidated before any stock result is produced.

Each transfer has one durable `transferId`. Every line emits exactly two immutable base-unit facts:

- source movement: negative quantity;
- destination movement: equal positive quantity.

The two StockKeys must be distinct. Source and destination use the same Product quantity snapshot and therefore the same base unit. Exact decimal conservation requires the two deltas to sum to zero.

Intra-Warehouse physical movement, such as Zone A to Zone B, and inter-Warehouse movement use the same contract. Cross-Branch transfer remains controlled by the trusted Step 4 policy and actor access to both ends.

The workflow constructs the entire transfer batch first and evaluates all movements in one ledger rebuild. If source stock is insufficient, a destination is invalid, a transfer identity is reused, or any other invariant fails, the caller receives no partially updated ledger or confirmed document.

This is semantic atomicity. Step 13 supplies real SQLite transaction atomicity and rollback.

## Quantity Adjustment Contract

Quantity adjustment also requires an `approved` and currently eligible document. Each line uses its already-snapshotted signed Product base quantity:

- positive quantity increases stock;
- negative quantity decreases stock.

A non-empty business reason is mandatory at confirmation and is retained in lifecycle evidence. Negative adjustments are subject to the same historical negative-stock policy as issues and backdated facts.

Adjustment changes physical quantity only. Costing, valuation, monetary revaluation, and accounting posting are excluded and remain owned by later phases.

## Reversal Compensation

Confirmed stock history is never deleted or rewritten. `reverseInventoryStockEffects` creates one exact inverse fact for every movement belonging to the confirmed original document.

Each compensating fact:

- uses a new durable movement ID;
- is grouped under the distinct `reversalDocumentId`;
- references the immutable original through `reversalOfMovementId`;
- targets the same StockKey;
- carries the exact opposite signed base quantity.

The ledger rejects a missing original reference, mismatched StockKey, non-opposite quantity, self-reference, or a second compensation of the same original movement.

The complete compensation batch is rebuilt against current stock history before the original lifecycle changes from `confirmed` to `reversed`. Consequently, reversing a receipt after some of its stock has been consumed can fail under the default no-negative-stock policy. Failure leaves the caller's original document and ledger unchanged.

Step 8 accepts the reversal business date/order as explicit inputs and validates movement chronology. Authoritative fiscal eligibility, persistence, concurrency, and durable replay/idempotency of the separate reversal operation are composed by Steps 9–13.

## Argin Bridge Preparation

Transfer and reversal relationships use durable identities (`transferId`, `reversalDocumentId`, `reversalOfMovementId`) rather than display numbers, local row IDs, or array positions. This preserves grouping and compensation semantics across future SQLite/PostgreSQL stores.

Step 12 will freeze the versioned Bridge envelope and partial-delivery rules. Derived balances are never synchronized as an independent authoritative fact.

## Deferred Scope

The following remain explicitly outside Step 8:

- full stock-count sessions;
- reservations and available-to-promise;
- lot/serial/expiry tracking;
- in-transit or two-stage transfer logistics;
- valuation and cost layers;
- accounting posting;
- persistence/UoW/idempotency implementation.

See [ADR-0020](../adr/ADR-0020-inventory-transfer-adjustment-workflows.md) for the decision record and the [Phase 20 fixed plan](../phases/phase-20-inventory-documents-plan.md) for owning steps.
