# Phase 16 — Accounting Reports

## Overview

Phase 16 delivers the first production-grade accounting reporting layer over the posted Journal Voucher source of truth. It introduces a shared report query vocabulary, deterministic accounting balance/turnover semantics, Trial Balance, General Ledger, Subsidiary Ledger, Journal Report, Accounting Dimension reports, secured Application query services, optimized SQLite read adapters, Persian RTL desktop reporting, drill-down traceability, Excel export, native print/PDF support, and comprehensive correctness/performance validation.

The fixed execution sequence and detailed evidence are recorded in [Phase 16 — Accounting Reports — Fixed Implementation Plan](phase-16-accounting-reports-plan.md). Architectural decisions are recorded in [ADR-0016 — Accounting Reports](../adr/ADR-0016-accounting-reports.md).

## Status

Implementation, local validation, final documentation, and final review are complete.

- Steps 1–17: **Completed**
- Step 18: **Documentation/final review/merge complete; semantic tag and GitHub Release publication remain manual repository-owner actions**
- Phase branch: `phase/16-accounting-reports`
- Prepared release version: `v0.16.0`
- Next phase: **Phase 17 — Parties**

## Objectives

Phase 16 establishes professional accounting reports without introducing a report designer, BI/data-warehouse subsystem, statutory financial statements that depend on future modules, or a second reporting source of truth.

The reporting layer must:

- read only authoritative posted accounting facts;
- preserve append-only reversal history;
- calculate opening, period debit/credit, and ending balances deterministically;
- aggregate account hierarchy without double counting;
- preserve Company, Branch, Fiscal Year/Period, date, account, dimension, currency, sorting, paging, and traceability context;
- remain independent from SQLite/Tauri at Domain/Application boundaries;
- reuse canonical report results for UI and export;
- support future PostgreSQL/API adapters without changing accounting semantics.

## Architecture

The reporting dependency direction is:

```text
Persian RTL Reports Center
        ↓
SecuredAccountingReportQueryService
        ↓
DefaultAccountingReportQueryService
        ↓
Canonical report engines
        ↓
AccountingReportDataReader contract
        ↑
SqliteAccountingReportDataReader
```

Domain/Application owns report semantics. SQLite owns retrieval and indexing. React owns presentation only.

The authoritative source is persisted Journal Lines whose Journal Voucher has final posted accounting effect. Original vouchers later marked `reversed` remain historical posted facts; the separate reversal voucher is the exact inverse posted fact. Reports therefore preserve both movements and obtain the correct net effect without deleting history.

## Common Query and Period Semantics

All Phase 16 reports use one normalized query vocabulary covering:

- mandatory Company scope;
- explicit currency;
- all-authorized-branches or one exact Branch;
- inclusive `fromDate <= voucherDate <= toDate` period;
- optional Fiscal Year and Fiscal Period;
- account root/list and descendant selection;
- generic accounting-dimension member filters;
- zero-balance inclusion;
- sorting, paging, and durable trace identity.

Opening balance includes eligible facts before `fromDate`. Period debit/credit includes the inclusive report range. Ending balance is opening plus period debit minus period credit. A selected Fiscal Period constrains period movement but does not erase prior-period opening facts within the selected Fiscal Year.

Business dates remain Gregorian internally and are presented as Solar Hijri in the Persian desktop UI.

## Reports

### Trial Balance

Trial Balance projects canonical opening, period, and ending debit/credit values. Supported 2/4/6/8 display modes are projections over the same canonical values. Totals use posting-enabled accounts only so hierarchy rows cannot double count descendants.

### General Ledger

General Ledger provides opening balance, deterministic detailed movement, voucher/date/description/debit/credit, running net balance, and durable Voucher/Journal Line trace identities. Parent-account ledgers aggregate real descendant posting movements without inventing synthetic parent journal lines.

### Subsidiary Ledger and Account Turnover

Subsidiary reporting reuses General Ledger semantics for posting-enabled accounts and provides opening, movement, running balance, ending balance, and turnover summaries with generic dimension support.

### Journal Report

Journal reporting provides chronological posted Journal Line facts with account metadata, dimensions, descriptions, references, debit/credit totals, stable ordering, and source traceability.

### Accounting Dimension Reports

Dimension reports group the same canonical posted facts by Dimension Member and Account × Dimension Member. They do not hard-code future dimension types. Phase 16 deliberately does not invent weighted allocation semantics for dimension types that permit multiple members; independently grouped multi-member values must not be interpreted as a ledger-reconciling allocation total without a future explicit accounting decision.

## Application Services and Security

Persistence-neutral Application contracts expose Trial Balance, General Ledger, Subsidiary Ledger, Journal, and Dimension report queries.

Granular permissions are:

- `accounting.reports.trial-balance.view`
- `accounting.reports.general-ledger.view`
- `accounting.reports.subsidiary-ledger.view`
- `accounting.reports.journal.view`
- `accounting.reports.dimensions.view`
- `accounting.reports.export`

`SecuredAccountingReportQueryService` enforces permission and Company/Branch scope before delegating to the canonical query service. UI visibility is convenience only and is never the security authority. Export authorization is independently rechecked before Preview, Excel, Print, or PDF actions.

## SQLite Persistence and Performance

Phase 16 adds no new accounting source tables. Migration `0015_accounting_report_indexes.sql` adds read-path indexes:

- `ix_journal_vouchers_reporting_scope`
- `ix_journal_line_dimensions_reporting`

`SqliteAccountingReportDataReader` uses set-based Journal Voucher + Journal Line retrieval and a second set-based dimension-assignment query, avoiding per-line N+1 access. SQL scope includes Company, currency, final posted/reversed lifecycle facts, upper date boundary, optional exact Branch, optional Fiscal Year, and generic dimension `EXISTS` filters.

Step 17 adds a representative SQLite performance/query-plan validator using 40,000 vouchers / 80,000 Journal Lines and `EXPLAIN QUERY PLAN`. The validation records elapsed time but intentionally does not impose a hardware-dependent wall-clock threshold; the release gate verifies scoped correctness and expected reporting-index usage.

## Desktop UI

The Persian RTL Accounting Reports Center at `/accounting/reports` provides:

- permission-aware report tabs;
- shared reusable filters;
- deliberate Draft Filters → Run → Executed Query behavior;
- Solar Hijri date presentation/input boundaries;
- compact density-aware accounting tables;
- loading, initial, empty, and error states;
- drill-down from aggregate balances to account movement;
- trace from detailed rows to the exact source Journal Voucher and Journal Line;
- full-screen print preview with locked background scrolling.

Drill-down always derives from the executed query, preserving Company, Branch, fiscal/date, account, dimension, and trace context rather than using unexecuted form state.

## Print and Export

Excel export uses UTF-8 RTL SpreadsheetML and canonical report DTO values; export adapters do not recalculate accounting balances.

Print/PDF uses the same canonical preview document. Desktop printing is bridged to native Tauri WebView printing so macOS opens the system Print/Save-as-PDF dialog reliably. Native print orientation is synchronized with the Phase 16 A4 landscape preview.

## Testing and Validation

Detailed evidence is recorded in:

- [Step 16 Domain and Application Report Test Matrix](phase-16-step-16-report-test-matrix.md)
- [Step 17 SQLite/Desktop/Performance and Monorepo Validation](phase-16-step-17-validation.md)

Coverage includes opening/period/ending balances, debit/credit sides, zero balances, hierarchy aggregation, reversal, inclusive date boundaries, Company/Branch/Fiscal scope, currency, dimensions, unposted exclusion, deterministic ordering, paging, stable errors, SQLite query shape, set-based dimension access, query-plan index usage, Desktop permissions, drill-down, traceability, Preview, Excel, native Print/PDF, and landscape orientation.

The repository owner confirmed Step 16 and Step 17 local validation as successful. This document records that user-confirmed evidence and does not claim the connector independently executed local `pnpm`, `sqlite3`, or Rust commands.

## Documentation Impact

Phase 16 updates:

- `README.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `ARCHITECTURE.md`
- `RELEASE_CHECKLIST.md`
- `docs/accounting/accounting-convention.md`
- `docs/database/database-design.md`
- `docs/security/security-model.md`
- `docs/glossary/domain-glossary.md`
- `docs/phases/README.md`
- ADR-0016 and Phase 16 implementation/evidence records

## Related ADRs

- [ADR-0016 — Accounting Reports](../adr/ADR-0016-accounting-reports.md)
- [ADR-0015 — Journal Lifecycle](../adr/ADR-0015-journal-lifecycle.md)
- [ADR-0010 — Chart of Accounts Model](../adr/ADR-0010-chart-of-accounts-model.md)

## Known Boundaries

Deferred from Phase 16:

- arbitrary report designer;
- BI dashboards, OLAP, or data warehouse;
- multi-company consolidation;
- advanced Cash Flow;
- future-module-dependent complete statutory P&L/Balance Sheet;
- PostgreSQL/Web reporting implementation;
- complex visualization and Phase 44 Advanced Reporting capabilities.

## Exit Criteria

Phase 16 implementation exit criteria are satisfied: report semantics are canonical and tested, SQLite/Desktop integration is validated, permissions and scope are enforced, drill-down/export are functional, performance query-plan evidence exists, documentation is reconciled, and the phase is ready for semantic release `v0.16.0`.

## Next Phase

Phase 17 — Parties.
