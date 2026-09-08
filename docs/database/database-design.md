# Database Design

## Purpose

This is the canonical data-architecture document for ArginAccounting.

## Principles

- Domain and application layers remain database-independent.
- SQLite is the first production persistence engine; PostgreSQL is a future target.
- Gregorian UTC timestamps are stored internally. Jalali conversion belongs to presentation and input boundaries.
- Monetary values use integer minor units or explicitly defined decimal precision; binary floating point is prohibited.
- Every tenant-owned record carries company scope and, where applicable, branch scope.
- Foreign keys, unique constraints, checks, and indexes enforce invariants close to the data.
- Posted financial records and audit history are immutable; corrections use explicit reversal or amendment workflows.
- Optimistic concurrency protects mutable aggregate roots.

## Naming

Tables and columns use English `snake_case`. Primary keys use stable identifiers. Foreign keys follow `<entity>_id`. Timestamps use `_at`; dates use `_date`.

## Migrations

Migrations are ordered, immutable after release, idempotent where practical, and applied inside controlled startup flows. Destructive changes require a migration plan, backup guidance, and rollback strategy.

Phase 16 adds migration `0015_accounting_report_indexes.sql`. It does not create a second reporting store or duplicate Journal facts.

Phase 17 adds:

- `0016_parties.sql` for Party master rows, roles, contacts, addresses, uniqueness rules, optimistic `version`, and bounded query indexes;
- `0017_party_sync_metadata.sql` for nullable Party tombstone metadata and company-scoped external references needed by future Argin Bridge/synchronization compatibility.

Party durable identity uses stable TEXT IDs independent from the human-readable Party code. Company-scoped code and official Iranian identity values are protected by unique constraints/indexes. Active/inactive status is business lifecycle state and is intentionally distinct from `deleted_at` tombstone semantics.

Phase 18 adds:

- `0018_taxpayer_unit_reference_data.sql` for versioned official Taxpayer measurement-unit reference data;
- `0019_products_services.sql` for Product/Service master rows, normalized identifiers, barcodes, external identifiers, Product Units, commercial/tax/operational master data, optimistic `version`, constraints, and bounded query indexes;
- `0020_product_sync_metadata.sql` for nullable Product tombstones and external source mappings used by future Argin Bridge compatibility;
- `0021_product_idempotency.sql` for durable request-scope idempotency claims/results.

Product durable identity uses stable TEXT `productId` values independent from Product code, SKU, barcode, title, and Taxpayer identifiers. Product persistence is company-scoped rather than branch-owned. Branch-specific stock, availability, pricing, and transactional behavior belong to their later owning modules.

Phase 19 adds:

- `0022_warehouses.sql` for Warehouse master rows, external identifiers, Zone/Location physical hierarchy, company/Branch scope constraints, optimistic `version`, and bounded lookup indexes;
- `0023_warehouse_sync_metadata.sql` for nullable Warehouse tombstones, origin/server-revision metadata and future Argin Bridge source mappings;
- `0024_warehouse_idempotency.sql` for durable Warehouse mutation request-scope idempotency claims/results;
- `0025_warehouse_maintenance_tombstones.sql` for Zone/Location tombstones and active/tombstone lookup indexes used by safe maintenance and future synchronization.

Warehouse, Zone and Location use stable TEXT durable IDs independent from mutable code/title metadata. Warehouse is always company-owned; Branch assignment is an organizational visibility rule rather than separate Warehouse identity. Stock quantities, movements, reservations, cost layers and Inventory documents are deliberately absent from Phase 19 persistence.

Phase 20 adds:

- `0026_inventory_documents.sql` for Inventory document headers/lines/lifecycle, immutable quantity movement facts, fiscal-year opening uniqueness, rebuildable balance projections, durable business ordering, idempotency outcomes, synchronization metadata, integrity constraints and query indexes.

Inventory quantities are stored as canonical decimal strings, never SQLite `REAL`. `inventory_stock_movements` is the authoritative quantity ledger. `inventory_stock_balances` is explicitly a rebuildable projection and must never become an independently editable source of stock truth. Movement, lifecycle and opening facts are append-only at the SQLite boundary through update/delete blocking triggers. Confirmed correction remains compensating movement/reversal, not destructive mutation.

## Indexing

Indexes are driven by real query paths. Company, branch, fiscal year, status, document number, date, correlation ID, and foreign-key access paths must be reviewed for each module.

Phase 16 report read paths add:

- `ix_journal_vouchers_reporting_scope` on Company/currency/lifecycle/date/Branch/Fiscal scope;
- `ix_journal_line_dimensions_reporting` on Company/Dimension Type/Member/Line lookup.

These indexes support the set-based Accounting Report reader. Step 17 validates them with the actual reader SQL and SQLite `EXPLAIN QUERY PLAN` on a representative 40,000-voucher / 80,000-line dataset. Elapsed time is recorded for diagnostics but no hardware-dependent wall-clock threshold is a canonical business requirement.

Phase 17 Party read paths use bounded SQL paging/selectors and indexed duplicate lookup. The Phase 17 performance validator builds a representative 50,000-Party dataset and requires SQLite query plans to use the accepted Party list/status, role-selector, and official-identity indexes. Runtime latency is diagnostic only; index use and bounded behavior are the portable quality gates.

Phase 18 Product/Service read paths use bounded paging/selectors and indexed strong-duplicate lookup. `@argin/product-tauri` provides `validate:performance`, which builds a representative 50,000-row Product/Service dataset and requires SQLite query plans to use the company/status/title list index, kind/status/title selector index, and company/SKU hard-duplicate index. Runtime latency is diagnostic only; bounded access and expected index use are the portable quality gates.

Phase 19 Warehouse read paths use bounded paging and Company/Branch-aware selectors. `@argin/warehouse-tauri` provides `validate:performance`, which builds a representative 50,000-Warehouse dataset plus 5,000 Zones and 20,000 Locations. SQLite `EXPLAIN QUERY PLAN` must use accepted indexes for company/status list reads, Branch-scoped selectors, external-identifier duplicate lookup, Zone lookup and Location lookup. Runtime latency is diagnostic only; bounded access and expected index use are the portable quality gates.

Phase 20 Inventory read paths add indexes for Company/status/date document lists, type/date and Branch/date filters, fiscal lookups, canonical StockKey kardex chronology, Product/date movement feeds, Warehouse/Product balance views, tombstones and future incremental synchronization changes. Step 21 owns representative `EXPLAIN QUERY PLAN` validation; Step 11 defines the intended indexes but does not claim performance execution.

## Reporting Read Model

Accounting reports read the existing Journal source tables. `SqliteAccountingReportDataReader` performs set-based Journal Voucher + Journal Line retrieval and a separate set-based dimension-assignment query. Per-line N+1 dimension reads are prohibited.

SQLite may optimize filtering/projection, but accounting semantics remain in database-neutral Domain/Application code. SQL does not become the authoritative definition of opening balance, period movement, hierarchy aggregation, reversal, or report totals.

## Party Master Data

Party persistence is company-scoped and normalized across `parties`, `party_roles`, `party_contacts`, and `party_addresses`. Child foreign keys preserve same-company ownership. Primary-contact/address uniqueness mirrors Domain invariants.

Party readers/list selectors remain bounded and do not expose an unbounded `findAll()` path. Bulk import writes through a Unit of Work so atomic mode cannot leave partial Party/contact/address state. Optimistic updates use `version` and map stale writes to a stable Application concurrency error.

`party_external_references` stores source-system identities separately from Party code and durable `partyId`, preserving future Bridge/import traceability without coupling current Desktop behavior to a network transport.

## Product and Service Master Data

Product persistence is normalized across `products`, `product_identifiers`, `product_barcodes`, `product_external_identifiers`, `product_units`, and `product_master_data`. Same-company composite foreign keys prevent child rows from crossing company boundaries. Strong identifiers such as Product code, SKU, reference code, barcode, Taxpayer goods/service ID, and external scheme/value mappings have company-scoped uniqueness constraints aligned with Application duplicate policy.

Product Units keep internal `unitId`/code separate from the official Taxpayer unit code. Official codes reference the versioned `taxpayer_units` dataset. Product master data may store default purchase/sales unit references and operational eligibility flags, but it stores no price, stock quantity, movement, valuation, accounting balance, or posting state.

`deleted_at` is synchronization tombstone metadata and remains separate from the ordinary `active`/`inactive` business lifecycle. `product_sync_external_references` preserves future source-system mappings without embedding network transport into current Product behavior.

Product readers and selectors are bounded. Multi-table Product writes use the shared database transaction abstraction through `SqliteProductUnitOfWork`; optimistic updates gate parent mutation by company/id/version before rewriting child state. SQLite uniqueness races are mapped to stable Product Application conflicts rather than being exposed as raw SQL errors.

## Warehouse Master Data

Warehouse persistence is normalized across `warehouses`, `warehouse_external_identifiers`, `warehouse_zones`, `warehouse_locations`, `warehouse_sync_external_references`, and `warehouse_idempotency`. Same-company composite foreign keys keep Branch assignment and physical hierarchy inside the owning Company/Warehouse scope.

Warehouse code is unique within Company scope and external namespace/value identities are unique within Company scope. Durable `warehouseId`, `zoneId`, and `locationId` remain the downstream reference identity; mutable codes/titles never replace those IDs.

Warehouse lifecycle (`active` / `inactive` / `archived`) is separate from `deleted_at` tombstone semantics. Zone/Location use `active` / `inactive` status plus tombstones. Ordinary repository/read paths exclude tombstoned rows, while future synchronization can still observe deletion metadata.

`Warehouse -> Zone -> Location` models optional physical structure only. Parent Location foreign keys preserve same Warehouse/Zone scope; higher-order cycle prevention remains a Domain/Application responsibility because SQL self-reference constraints alone cannot detect arbitrary ancestry cycles.

Warehouse reads/selectors are bounded and Company/Branch-aware. Without Branch context, future-consumer selection is company-wide-only by default; with Branch context, the selected Branch plus optional company-wide Warehouses are eligible. These visibility rules are applied in persistence queries before `LIMIT`.

Multi-write Warehouse operations use `SqliteWarehouseUnitOfWork`; root optimistic updates use version-aware compare-and-swap semantics. `warehouse_idempotency` stores durable completed request results so retries do not duplicate successful mutations. External Inventory/Purchase/Sales/Manufacturing references remain outside this schema and must later plug into the Warehouse dependency-guard contract rather than creating reverse Warehouse dependencies.

## Inventory Documents and Quantity Ledger

Inventory persistence is normalized across `inventory_documents`, `inventory_document_lines`, `inventory_document_lifecycle`, `inventory_stock_movements`, `inventory_opening_balances`, `inventory_stock_balances`, `inventory_business_orders`, and `inventory_idempotency`.

Document durable ID is separate from `document_number`. Number uniqueness is scoped by Company + fiscal year + origin Branch + document type and uses an expression index so nullable SQL semantics cannot create duplicate business numbers. Draft deletion is represented by `deleted_at`; the schema rejects tombstones for non-Draft lifecycle states. Source-system identity is stored separately from display numbering.

Lines keep durable `lineId`, ordered position, Product identity, source references, exact entered/base quantity strings, unit snapshot payload, and source/destination Warehouse/Zone/Location identities. Current master eligibility is still revalidated by Application services; historical snapshot rows are not rewritten when Product or Warehouse metadata later changes.

`inventory_stock_movements` contains durable `movementId`, document/line linkage, `transferId`, `reversalOfMovementId`, Product/StockKey, business date/order, UTC record time and exact signed base-unit delta. Update/delete triggers enforce append-only behavior. A partial unique index ensures each original movement can be reversed at most once. Transfer source/destination facts remain separate rows joined by one durable transfer identity.

Opening uniqueness is materialized in `inventory_opening_balances` and enforced by Company + fiscal year + Product + Warehouse + normalized nullable Zone/Location. Opening facts are append-only.

`inventory_stock_balances` stores a rebuild cache by canonical `stock_key`. Its quantity and last movement metadata may be replaced atomically after ledger rebuild; it is not synchronized as an independent authoritative fact. Expression uniqueness normalizes nullable Zone/Location identity.

`inventory_business_orders` owns durable positive same-date order allocation per Company. `inventory_idempotency` owns Company-scoped request-key claims and the completed operation/fingerprint/document version/status outcome required for replay after restart.

Cross-row rules that depend on the complete movement set—negative historical balance, transfer conservation, exact reversal compensation, payload fingerprint semantics and concurrent stock validation—remain Application/UoW responsibilities. Step 13 must execute their read-check-write sequence inside a real SQLite transaction; schema constraints complement but do not replace that logic.

## Transactions

Use explicit Unit of Work boundaries for operations that write multiple aggregates, history records, audit entries, number-series values, or posting results. Phase 16 report execution is read-only and does not introduce a report-write transaction.

Party parent/role/contact/address writes use one Party Unit of Work transaction. Product parent/identifier/unit/master-data writes use one Product Unit of Work transaction. Warehouse root/external-identifier/physical writes use the Warehouse Unit of Work where atomic composition is required. Inventory confirmation must write document version, lifecycle, movements, balance projection, opening facts, business ordering and idempotency outcome as one SQLite transaction in Step 13. Shared Audit composition remains owned by its later integration step.

## Future Compatibility

SQL dialect-specific logic must stay inside infrastructure packages. Domain contracts must not expose SQLite-specific types or syntax. Future PostgreSQL/API report adapters must preserve the same normalized query and canonical result semantics.

Future Party, Product, Warehouse and Inventory PostgreSQL/HTTP/Argin Bridge adapters must preserve durable identity, company scope, Branch visibility semantics where applicable, optimistic versioning, tombstone semantics, exact quantity representation, movement immutability, transfer/reversal linkage, bounded selection contracts, idempotency expectations, dependency boundaries and stable Application errors. Full synchronization remains Phase 45.
