# Purchase Domain Model

## Status

Phase 22 Steps 2–3 domain foundation. Persistence, pricing, lifecycle orchestration and downstream integration are intentionally deferred to their owning steps.

## Ownership

`@argin/purchase` owns persistence-neutral Purchase commercial aggregates and historical commercial snapshots. It does not own Inventory quantity movements, Inventory Valuation algorithms, accounting postings, Sales pricing or Treasury settlement.

## Aggregate Root

`PurchaseDocumentSnapshot` is the Phase 22 aggregate root foundation. Its durable identity is `documentId`; SQLite row identity, display numbers and future server-generated database keys must never replace this durable ID.

The header contains:

- `documentId`
- `companyId`
- `supplierId`
- immutable `supplierSnapshot`
- `businessDate`
- optional description
- optional source reference
- optional correction reference
- ordered immutable lines
- optimistic version
- created/updated timestamps

Document type, lifecycle status, numbering/fiscal scope and Approval semantics belong to later fixed steps.

## Supplier Historical Snapshot

Every Purchase document carries a frozen `PurchaseSupplierSnapshot` so later Party edits do not rewrite historical supplier facts. The snapshot preserves:

- Company and supplier durable IDs;
- supplier code and display name;
- natural-person/legal-entity classification;
- national code / national ID where applicable;
- economic number;
- tax file number.

The snapshot `companyId` and `supplierId` must exactly match the aggregate header. The Party master remains authoritative for current master data; the Purchase snapshot is authoritative only for the historical commercial document that captured it.

## Lines and Item Historical Snapshot

Every `PurchaseDocumentLineSnapshot` has a durable `lineId`, positive unique `position`, durable `itemId`, line classification, frozen `itemSnapshot`, optional description and optional source reference.

Three line classifications remain fixed:

- `stock-product`: Product line eligible for future Inventory receipt/movement and Valuation Cost Input linkage.
- `non-stock-product`: Product line commercially purchased without stock ownership in Purchase.
- `service`: Service line and therefore never stock-tracked.

Each line now captures historical Product/Service metadata:

- item durable ID, item type, code and display name;
- SKU and reference code;
- 13-digit Taxpayer goods/service ID when present;
- purchase description, brand and model;
- stock-tracking flag;
- tax treatment and VAT basis-point rate;
- default purchase-unit identity/display and Taxpayer unit code when configured.

The snapshot intentionally does **not** contain unit price, quantity, discounts, charges or calculated tax amounts. Those transaction semantics belong to Step 4 and Step 7.

Structural invariants include:

- `stock-product` and `non-stock-product` require `itemType = product`;
- `service` requires `itemType = service`;
- `stock-product` requires the captured Product snapshot to be stock-tracked;
- `non-stock-product` and `service` cannot carry a stock-tracked item snapshot;
- snapshot `itemId` and `itemType` must match the line durable facts;
- service snapshots can never claim stock tracking;
- Taxpayer goods/service ID, when present, must remain the validated 13-digit identifier;
- taxable items require a valid basis-point rate; non-taxable treatments cannot silently carry a VAT rate.

## Unit Snapshot Boundary

Step 3 snapshots the default purchase-unit identity, code, title and Taxpayer unit code only. Exact entered/base quantity, conversion ratio application, precision semantics and rounding belong to Step 4. This prevents Step 3 from prematurely owning quantity arithmetic while still preserving the master-data identity visible when the Purchase fact was created.

## Source and Correction References

`PurchaseSourceReference` preserves external/import/upstream identity without coupling the aggregate to a persistence adapter. It consists of `sourceSystem`, `sourceDocumentId` and optional `sourceLineId`.

`PurchaseCorrectionReference` records a durable link to another Purchase document plus a required reason. The foundation only defines the safe identity relationship; the actual correction/return workflow and compensation rules belong to Step 12.

A document cannot reference itself as its correction target. A Purchase source reference cannot identify the same Purchase document as its own upstream source.

## Historical Immutability Rule

Changing Party, Product or Service Master Data after a Purchase document is created must not mutate the embedded Purchase snapshots. Rehydration validates and freezes the stored historical snapshots again. Future UI/query layers must display current master data only when explicitly requested; document history uses the captured Purchase facts.

This rule is required for Audit, reproducible reports, future Purchase Posting and Argin Bridge synchronization.

## Argin Bridge Foundation

Steps 2–3 establish the durable identity and historical-fact subset needed by future Bridge envelopes:

- Purchase `documentId` and `lineId` survive store changes;
- `companyId`, `supplierId` and `itemId` are durable cross-module references rather than SQLite row IDs;
- supplier/item snapshot facts travel with the Purchase fact instead of being re-read from mutable remote Master Data;
- Taxpayer identifiers and unit codes remain historical commercial metadata;
- external source and correction references are explicit durable facts;
- version/timestamps can later participate in optimistic concurrency and synchronization metadata;
- rehydration validates the same domain rules after serialization/transport.

Step 18 owns the complete versioned Argin Bridge synchronization envelope, request identity, tombstone and dependency semantics. Steps 2–3 deliberately do not invent transport contracts early.

## Deferred to Later Fixed Steps

- Step 4: exact quantity, unit conversion, currency, price, discounts, charges, taxes and rounding.
- Step 5: document types and lifecycle states/transitions.
- Step 6: Branch/fiscal scope and Number Series.
- Step 7: pricing/totals engine.
- Steps 8–12: receipt/invoice matching, Inventory/Valuation linkage and return/correction workflows.
- Steps 13–19: Application, persistence, idempotency/concurrency, Bridge, permission/Approval/Audit.

## Package Surface

`@argin/purchase` exposes the aggregate and snapshot factories through `packages/purchase/src/index.ts`. No SQLite, Tauri, UI or accounting dependency is introduced by Steps 2–3.
