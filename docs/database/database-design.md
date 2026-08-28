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

## Indexing

Indexes are driven by real query paths. Company, branch, fiscal year, status, document number, date, correlation ID, and foreign-key access paths must be reviewed for each module.

Phase 16 report read paths add:

- `ix_journal_vouchers_reporting_scope` on Company/currency/lifecycle/date/Branch/Fiscal scope;
- `ix_journal_line_dimensions_reporting` on Company/Dimension Type/Member/Line lookup.

These indexes support the set-based Accounting Report reader. Step 17 validates them with the actual reader SQL and SQLite `EXPLAIN QUERY PLAN` on a representative 40,000-voucher / 80,000-line dataset. Elapsed time is recorded for diagnostics but no hardware-dependent wall-clock threshold is a canonical business requirement.

## Reporting Read Model

Accounting reports read the existing Journal source tables. `SqliteAccountingReportDataReader` performs set-based Journal Voucher + Journal Line retrieval and a separate set-based dimension-assignment query. Per-line N+1 dimension reads are prohibited.

SQLite may optimize filtering/projection, but accounting semantics remain in database-neutral Domain/Application code. SQL does not become the authoritative definition of opening balance, period movement, hierarchy aggregation, reversal, or report totals.

## Transactions

Use explicit Unit of Work boundaries for operations that write multiple aggregates, history records, audit entries, number-series values, or posting results. Phase 16 report execution is read-only and does not introduce a report-write transaction.

## Future Compatibility

SQL dialect-specific logic must stay inside infrastructure packages. Domain contracts must not expose SQLite-specific types or syntax. Future PostgreSQL/API report adapters must preserve the same normalized query and canonical result semantics.
