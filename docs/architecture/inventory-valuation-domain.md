# Inventory Valuation Domain Foundation

## Status

Phase 21 Step 2 — Inventory Valuation Domain Model — completed.

This record defines the monetary valuation domain that consumes immutable Phase 20 inventory movement facts. It does not implement FIFO or moving-average algorithms; those belong to Step 3.

## Ownership Boundary

Phase 20 remains the authoritative source of quantity truth:

- confirmed stock movements are append-only;
- quantity chronology is `businessDate -> businessOrder -> documentId -> lineId -> movementId`;
- transfer and reversal identities are durable;
- stock balances are rebuildable projections.

Phase 21 adds monetary interpretation without rewriting any Phase 20 document, line, movement or quantity balance.

`@argin/inventory` owns the valuation Domain/Application model. SQLite persistence remains the responsibility of the Inventory Tauri adapter in later Phase 21 steps.

## Core Domain Records

### InventoryValuationEntrySnapshot

A valuation entry is a durable monetary interpretation of one immutable Phase 20 stock movement.

It carries:

- independent durable `valuationEntryId`;
- Company/Product/StockKey scope copied from the source movement;
- immutable source references: `movementId`, `documentId`, `lineId`, optional `transferId`, optional `reversalOfMovementId`;
- deterministic business chronology from the source movement;
- valuation method plus `strategyVersion`;
- ISO currency code;
- exact base-unit quantity;
- exact decimal unit cost;
- signed safe-integer monetary total in the currency's smallest unit;
- explicit `resolved` / `unresolved` cost state;
- optimistic `revision`.

An unresolved entry is a valid domain state. It allows a quantity fact to exist before a reliable monetary basis becomes available, without inventing a zero cost.

### InventoryCostLayerSnapshot

A cost layer is a durable valuation layer rooted in a resolved valuation entry. It retains:

- independent durable `costLayerId`;
- source valuation and movement identities;
- method/strategy/currency identity;
- opening business chronology;
- original and remaining exact quantities;
- exact decimal unit cost;
- original and remaining safe-integer monetary values;
- optimistic `revision`.

Layer consumption rules are deliberately deferred to Step 3.

### InventoryValuationBasisSnapshot

The basis identifies the valuation stream policy for a stock identity:

- Company/Product/StockKey;
- method;
- strategy version;
- currency;
- effective-from business date.

The stream key binds StockKey + method + strategy version + currency so two methods or currencies cannot silently share one valuation stream.

## Monetary Invariants

The shared Platform Money contract is authoritative for monetary totals:

- total monetary values are JavaScript safe integers;
- they represent the smallest unit of the declared currency;
- IRR is the default currency;
- currency codes are normalized as ISO 4217 three-letter codes;
- floating-point monetary totals are rejected.

Unit cost is intentionally represented as an exact non-negative decimal string because weighted-average cost per base unit can be fractional even when the final monetary total must be rounded to an integer smallest-currency-unit value. Rounding/allocation policy belongs to the valuation strategy in Step 3.

Inventory quantity semantics remain unchanged: quantities use the Phase 20 exact decimal-string contract.

## Movement Classification

Valuation does not infer commercial or Inventory document semantics that are absent from the immutable movement fact.

The domain classifies a movement only as:

- `inbound` — positive ordinary movement;
- `outbound` — negative ordinary movement;
- `transfer` — movement carrying a Phase 20 `transferId`;
- `reversal` — movement carrying a Phase 20 `reversalOfMovementId`.

A quantity-adjustment document therefore remains a Phase 20 source-document concern. Its confirmed positive/negative movement is valued according to its immutable movement direction; Phase 21 does not fabricate an `adjustment` kind from missing data.

## Resolution Lifecycle

`createUnresolvedInventoryValuationEntry(...)` creates an explicit pending monetary state bound to a movement and a reason.

`resolveInventoryValuationEntry(...)`:

- requires the expected revision;
- preserves source identity and chronology;
- normalizes exact unit cost;
- validates safe-integer total cost;
- requires ordinary outbound totals to be non-positive and ordinary inbound totals to be non-negative;
- records `valuedAt`;
- increments revision.

Transfer and reversal monetary sign/conservation rules depend on paired/source valuation and are deferred to Steps 7 and 8 rather than guessed in the Step 2 primitive.

## Cost Layer Foundation

`createInventoryCostLayer(...)` accepts only a resolved source valuation entry. It cannot create a layer from unresolved cost state.

This prevents an unknown inbound cost from silently becoming a zero-cost FIFO layer. FIFO consumption and moving-average state evolution are Step 3 concerns.

## Deterministic Recalculation Readiness

Every valuation fact retains the source business chronology and explicit strategy version. This is required for later backdated recalculation:

1. identify the affected valuation stream;
2. order immutable movement facts by canonical Phase 20 chronology;
3. replay the same versioned strategy;
4. replace/revise monetary derived state without changing quantity history.

Step 9 owns the actual recalculation engine.

## Argin Bridge Compatibility

Step 2 establishes Bridge-safe domain identity but does not implement synchronization transport.

Bridge-relevant invariants are:

- `valuationEntryId` and `costLayerId` are durable identities and must survive future stores;
- source `movementId`, `documentId`, `lineId`, `transferId` and `reversalOfMovementId` are preserved unchanged;
- currency, method and `strategyVersion` travel with valuation facts;
- revisions support future optimistic conflict detection;
- canonical movement chronology makes deterministic replay possible on SQLite and a future server store;
- quantity balances and future valuation summaries remain derived projections, not independent authoritative sync facts.

Live outbox/transport, acknowledgements, retries, server conflict resolution and PostgreSQL/.NET synchronization remain owned by the later Synchronization / Argin Bridge phase.

## Explicitly Deferred from Step 2

- FIFO layer consumption algorithm;
- moving weighted-average algorithm;
- rounding/allocation policy;
- product/company valuation policy changes;
- inbound landed-cost allocation;
- transfer cost conservation;
- reversal valuation restoration;
- backdated recalculation;
- negative-stock cost resolution;
- repository/Application contracts;
- SQLite schema/persistence;
- permissions/Audit;
- valuation reports/UI;
- live Bridge transport.

## Step 2 Test Coverage Added

`packages/inventory/tests/inventory-valuation-domain.test.ts` covers the domain foundation for:

- immutable Phase 20 source identity;
- unresolved-to-resolved cost lifecycle;
- optimistic revision progression;
- ordinary inbound/outbound monetary sign rules;
- safe-integer monetary totals;
- default/normalized IRR currency;
- cost-layer resolved-state guard;
- method/version/currency stream identity;
- durable transfer and reversal references.

This documentation records test coverage added in Step 2. It does not claim executable test output unless such output is separately recorded.