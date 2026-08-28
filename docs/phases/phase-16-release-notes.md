# Phase 16 — Accounting Reports — Release Notes

Prepared semantic version: `v0.16.0`

## Highlights

- Shared persistence-neutral accounting-report query, filter, and period model.
- Trial Balance with hierarchy-safe totals and canonical 2/4/6/8 projections.
- General Ledger and Subsidiary Ledger with opening/running/ending balances and durable Journal traceability.
- Chronological Journal Report and generic Accounting Dimension reports.
- Granular report permissions, Company/Branch scope enforcement, and independent export permission.
- Persian RTL Accounting Reports Center with Solar Hijri presentation, reusable filters, deliberate execution, drill-down, and source Journal tracing.
- Excel SpreadsheetML export and full-screen A4 Preview.
- Native Tauri Print/Save-as-PDF with landscape orientation matching Preview.
- SQLite reporting indexes, set-based reads, N+1 regression protection, and representative `EXPLAIN QUERY PLAN` validation.
- Domain/Application, SQLite, Desktop, and monorepo validation recorded as repository-owner-confirmed before release preparation.

## Migration

`0015_accounting_report_indexes.sql`

Adds:

- `ix_journal_vouchers_reporting_scope`
- `ix_journal_line_dimensions_reporting`

No new accounting source tables are introduced.

## Permissions

- `accounting.reports.trial-balance.view`
- `accounting.reports.general-ledger.view`
- `accounting.reports.subsidiary-ledger.view`
- `accounting.reports.journal.view`
- `accounting.reports.dimensions.view`
- `accounting.reports.export`

## Scope Boundaries

Deferred: arbitrary report designer, BI/OLAP/data warehouse, multi-company consolidation, advanced Cash Flow, complete future-module-dependent statutory statements, PostgreSQL/Web reporting adapter, and complex Phase 44 Advanced Reporting features.

## Next Phase

Phase 17 — Parties.
