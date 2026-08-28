# Phase 16 Step 17 — SQLite/Desktop/Performance and Monorepo Validation

## Status

Implementation complete. Local validation is pending repository-owner execution.

## Scope

Step 17 validates the Phase 16 reporting implementation across the SQLite adapter, Desktop composition, representative query-plan/performance behavior, and the complete monorepo validation path. It does not change accounting semantics established by Steps 2–16.

## SQLite Repository and Query Correctness

- `SqliteAccountingReportDataReader` now exposes the exact fact and dimension-assignment SQL query builders used by the runtime reader.
- Runtime reads and performance validation therefore share one SQL source instead of duplicating a benchmark-only query.
- `sqlite-accounting-report-data-reader.test.ts` now verifies:
  - posted/reversed source scope;
  - exact branch versus all-branches behavior;
  - fiscal-year and dimension predicate composition;
  - absence of a global fiscal-period predicate so opening-balance semantics remain correct;
  - identical scope parameters for fact and assignment reads;
  - deterministic SQL ordering;
  - a representative 5,000-line snapshot still performs one set-based fact read and one set-based assignment read rather than per-line N+1 queries.

## Representative SQLite Query-Plan Validation

`packages/accounting-tauri/scripts/validate-accounting-report-performance.ts` creates a temporary SQLite database with:

- 20,000 in-scope posted vouchers;
- 20,000 out-of-scope/noise vouchers;
- 80,000 total journal lines;
- dimension assignments for every line;
- the production Phase 16 report indexes from `0015_accounting_report_indexes.sql`.

The validator then:

1. builds the report SQL through `createAccountingReportFactSqlQuery`;
2. binds the same company/currency/branch/fiscal-year/dimension scope used by the runtime reader;
3. executes `EXPLAIN QUERY PLAN`;
4. requires `ix_journal_vouchers_reporting_scope`;
5. requires `ix_journal_line_dimensions_reporting` for the correlated dimension predicate;
6. executes the scoped report query and requires exactly 40,000 in-scope journal lines;
7. records wall-clock time as diagnostic evidence without a hardware-dependent hard threshold.

This guards index use and representative set-based behavior without inventing an arbitrary machine-specific latency requirement.

## Desktop Regression Coverage

`apps/desktop/tests/accounting-reports-phase16-regression.test.ts` provides one integrated Phase 16 regression guard over the existing focused UI tests. It verifies that:

- the secured Application query service remains in front of the SQLite reader;
- export authorization remains independent and is rechecked at execution time;
- all-branches authorization is explicit;
- draft filter state remains separate from the exact executed query;
- aggregate drill-down preserves report context;
- detail drill-down preserves Voucher ID and Journal Line ID traceability;
- Journal trace still requires journal-view permission;
- Excel, Preview, and PDF/native-print paths reuse the export projection and do not import report calculation engines into presentation code;
- Persian RTL SpreadsheetML and A4 landscape/native-print contracts remain present.

## Unified Validation Command

The root command below executes focused Phase 16 validation first and then the complete monorepo gates:

```bash
pnpm validate:phase16
```

It expands to:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/accounting-tauri validate:reports-performance
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop build
pnpm typecheck
pnpm test
pnpm build
```

The query-plan validator requires the `sqlite3` CLI because Step 17 deliberately validates the actual SQLite planner rather than a mocked planner. No new runtime dependency is introduced.

## Validation Evidence

- Step 16 local `@argin/accounting` typecheck/test: confirmed green by repository owner before Step 17 started.
- Step 17 focused SQLite/Desktop/performance validation: pending local execution.
- Step 17 full monorepo typecheck/test/build: pending local execution.

After local green confirmation, this document and the frozen Phase 16 plan should be updated with the final execution evidence before Step 18 release work.
