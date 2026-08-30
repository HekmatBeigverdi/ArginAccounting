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

## Indexing

Indexes are driven by real query paths. Company, branch, fiscal year, status, document number, date, correlation ID, and foreign-key access paths must be reviewed for each module.

Phase 16 report read paths add:

- `ix_journal_vouchers_reporting_scope` on Company/currency/lifecycle/date/Branch/Fiscal scope;
- `ix_journal_line_dimensions_reporting` on Company/Dimension Type/Member/Line lookup.

These indexes support the set-based Accounting Report reader. Step 17 validates them with the actual reader SQL and SQLite `EXPLAIN QUERY PLAN` on a representative 40,000-voucher / 80,000-line dataset. Elapsed time is recorded for diagnostics but no hardware-dependent wall-clock threshold is a canonical business requirement.

Phase 17 Party read paths use bounded SQL paging/selectors and indexed duplicate lookup. The Phase 17 performance validator builds a representative 50,000-Party dataset and requires SQLite query plans to use the accepted Party list/status, role-selector, and official-identity indexes. Runtime latency is diagnostic only; index use and bounded behavior are the portable quality gates.

## Reporting Read Model

Accounting reports read the existing Journal source tables. `SqliteAccountingReportDataReader` performs set-based Journal Voucher + Journal Line retrieval and a separate set-based dimension-assignment query. Per-line N+1 dimension reads are prohibited.

SQLite may optimize filtering/projection, but accounting semantics remain in database-neutral Domain/Application code. SQL does not become the authoritative definition of opening balance, period movement, hierarchy aggregation, reversal, or report totals.

## Party Master Data

Party persistence is company-scoped and normalized across `parties`, `party_roles`, `party_contacts`, and `party_addresses`. Child foreign keys preserve same-company ownership. Primary-contact/address uniqueness mirrors Domain invariants.

Party readers/list selectors remain bounded and do not expose an unbounded `findAll()` path. Bulk import writes through a Unit of Work so atomic mode cannot leave partial Party/contact/address state. Optimistic updates use `version` and map stale writes to a stable Application concurrency error.

`party_external_references` stores source-system identities separately from Party code and durable `partyId`, preserving future Bridge/import traceability without coupling current Desktop behavior to a network transport.

## Transactions

Use explicit Unit of Work boundaries for operations that write multiple aggregates, history records, audit entries, number-series values, or posting results. Phase 16 report execution is read-only and does not introduce a report-write transaction.

Party parent/role/contact/address writes use one Party Unit of Work transaction. The current shared Audit sink is composed as a successful mutation side effect; Party persistence and shared Audit persistence are not claimed to be one cross-store atomic transaction.

## Future Compatibility

SQL dialect-specific logic must stay inside infrastructure packages. Domain contracts must not expose SQLite-specific types or syntax. Future PostgreSQL/API report adapters must preserve the same normalized query and canonical result semantics.

Future Party PostgreSQL/HTTP/Argin Bridge adapters must preserve durable Party ID, company scope, optimistic versioning, tombstone semantics, external-reference uniqueness, bounded selection contracts, and stable Application errors. Full synchronization remains Phase 45.
