# Phase 16 — Accounting Reports — Fixed Implementation Plan

## Status

Phase 16 is active. Steps 1–14 are complete; Step 15 is next.

## Governance Rule

This plan is frozen for the duration of Phase 16.

Before starting every step:

1. Read this document.
2. Read `docs/development/documentation-governance.md`.
3. Read `docs/development/github-publishing-workflow.md`.
4. Confirm the current branch and latest commit.
5. Confirm the previous step's exit criteria.
6. State the current step number, scope, expected files, and validation commands before implementation.
7. Update only status and evidence sections unless an explicit Change Request is approved.

A step may not be reordered, split, merged, removed, renamed, or materially expanded without explicit user approval. Newly discovered work must be recorded under **Change Requests** and must not silently alter the sequence.

## Phase Objective

Deliver the first production-grade Accounting Reports layer over the posted Journal Voucher source of truth. Phase 16 introduces reusable report query contracts, deterministic balance and turnover computation, Trial Balance, General Ledger, Account/Subsidiary Ledger, Journal reporting, accounting-dimension reporting, optimized SQLite query adapters, reporting permissions and scope isolation, Persian RTL desktop report workspaces, drill-down traceability to Journal Vouchers, print/preview/export surfaces, and comprehensive correctness/performance validation.

## Baseline

- Phase 15 — Journal Lifecycle is completed and released as `v0.15.0`.
- `main` baseline at Phase 16 kickoff: `4990501cba89bca0cbe2a342d45ad89a40311b77`.
- Phase 13 provides persisted balanced Journal Vouchers and Journal Lines.
- Phase 15 provides authoritative lifecycle state, final posting, reversal lineage, approval evidence, and posted-fact immutability.
- Phase 11 provides accounting dimensions and account-dimension policy.
- Phase 10 provides the Chart of Accounts hierarchy and coding model.
- Phase 06 provides fiscal year and fiscal period boundaries.
- Phase 09 provides shared query, Unit of Work, concurrency, events, and platform infrastructure.
- Phase 14 provides the canonical Persian RTL desktop design system and global display-density contract.

## Scope Boundaries

Included: report query/filter model, report-period semantics, balance/turnover engine, Trial Balance, General Ledger, Account/Subsidiary Ledger, Journal Report, accounting-dimension reports, Application query contracts/DTOs, SQLite reporting adapters and query optimization, reporting permissions/company-branch scope, Persian RTL report-center UI, filters/drill-down/traceability, print preview, Excel/PDF export, tests, performance validation, documentation, merge, and release.

Excluded: arbitrary drag-and-drop report designer, OLAP/data warehouse, consolidated multi-company reporting, advanced BI dashboards, full statutory financial statements that depend on future operational modules, PostgreSQL/Web reporting implementation, and Phase 44 Advanced Reporting capabilities.

## Reporting Design Principles

- Posted accounting facts are the reporting source of truth.
- Draft, pending-approval, and approved-but-unposted Journal Vouchers never affect final accounting balances.
- Reversal semantics preserve append-only history and deterministic net effects.
- Domain/Application owns accounting/report semantics; React never owns balance logic.
- SQLite is an adapter and optimization boundary, not the source of business rules.
- Company and Branch scope isolation is mandatory at the Application boundary.
- Account hierarchy aggregation must not double-count child balances.
- Date and fiscal boundaries are explicit and deterministic.
- Durable dates remain Gregorian internally; Persian UI presents Solar Hijri.
- Report results support traceability to underlying Journal Voucher/lines.
- Large datasets use projections/aggregation/pagination rather than loading the entire journal.
- Export and print reuse canonical report results.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | Reporting Domain Analysis and ADR | Completed |
| 3 | Common Report Query, Filter, and Period Model | Completed |
| 4 | Account Balance and Turnover Engine | Completed |
| 5 | Trial Balance | Completed |
| 6 | General Ledger | Completed |
| 7 | Subsidiary Ledger and Account Turnover | Completed |
| 8 | Journal Report | Completed |
| 9 | Accounting Dimension Reports | Completed |
| 10 | Application Contracts, DTOs, and Query Services | Completed |
| 11 | SQLite Reporting Repository and Query Optimization | Completed |
| 12 | Reporting Permissions, Company/Branch Scope, and Security | Completed |
| 13 | Persian RTL Accounting Reports Center UI | Completed |
| 14 | Filters, Drill-down, and Journal Traceability UI | Completed |
| 15 | Print, Preview, Excel, and PDF Export | Not started |
| 16 | Domain and Application Report Test Matrix | Not started |
| 17 | SQLite/Desktop/Performance and Monorepo Validation | Not started |
| 18 | Documentation, Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Plan Freeze
- Confirm Phase 15 release baseline.
- Confirm current `main` head.
- Create `phase/16-accounting-reports` from current `main`.
- Freeze dependencies, scope, governance, and this 18-step sequence.
- Record Step Status from the start of the phase.

Exit: branch and fixed plan exist; no reporting behavior introduced.

Status: Completed

Evidence: Phase 15 release and kickoff SHA were confirmed; phase branch and fixed plan were created.

### Step 2 — Reporting Domain Analysis and ADR
- Reconcile Journal Voucher, lifecycle, Chart of Accounts, accounting dimensions, fiscal management, scope, and shared query infrastructure.
- Define source data, posting/reversal semantics, fiscal/date boundaries, hierarchy aggregation, balance semantics, branch behavior, zero-balance policy, drill-down identity, and rejected alternatives.

Exit: reporting architecture and accounting semantics are unambiguous before implementation.

Status: Completed

Evidence: `docs/adr/ADR-0016-accounting-reports.md` fixes posted-fact, reversal, hierarchy, period, scope, dimension, traceability, adapter, and currency semantics.

### Step 3 — Common Report Query, Filter, and Period Model
- Define persistence-neutral report period and common filter contracts.
- Cover company, branch, fiscal year/period, date range, account range/hierarchy, dimensions, zero-balance inclusion, sorting, pagination, and traceability context.

Exit: all Phase 16 reports share one stable filter/query vocabulary instead of duplicating semantics.

Status: Completed

Evidence: `packages/accounting/src/reporting.ts`; user confirmed local typecheck/tests green.

### Step 4 — Account Balance and Turnover Engine
- Implement deterministic opening balance, period debit, period credit, and ending balance computation.
- Support account hierarchy aggregation without double counting.
- Enforce company/branch/fiscal/date scope semantics.

Exit: focused Domain/Application tests prove the reusable accounting math independently of SQLite/UI.

Status: Completed

Evidence: `packages/accounting/src/reporting-balance.ts`; user confirmed local typecheck/tests green.

### Step 5 — Trial Balance
- Implement Trial Balance projections over the canonical balance engine.
- Support justified column variants and hierarchy/zero-balance presentation.

Exit: Trial Balance totals reconcile deterministically with posted Journal facts.

Status: Completed

Evidence: `packages/accounting/src/trial-balance.ts`; hierarchy-safe totals and 2/4/6/8 projection tests; user confirmed local tests green.

### Step 6 — General Ledger
- Implement account-ledger reporting with date, voucher number, description, debit, credit, and running balance.
- Preserve stable ordering and traceability to Journal Voucher/line identifiers.

Exit: General Ledger can reconstruct the posted movement of an account for a deterministic period.

Status: Completed

Evidence: `packages/accounting/src/general-ledger.ts`; user fix `99979ff1df76ddbc8034eddadb9f392f02cc4971` is retained; local tests confirmed green.

### Step 7 — Subsidiary Ledger and Account Turnover
- Implement detailed account/subsidiary movement reporting.
- Include opening balance, detailed movement, running balance, and dimension-aware projections where applicable.

Exit: users can inspect one account's detailed movement and reconcile it to aggregate balances.

Status: Completed

Evidence: `packages/accounting/src/subsidiary-ledger.ts`; posting-account turnover, running balance, generic dimensions, selection edge cases; user confirmed local tests green.

### Step 8 — Journal Report
- Implement chronological Journal reporting over posted accounting facts.
- Include voucher/date/description/account/dimension/debit/credit fields needed for professional accounting review.

Exit: report ordering and totals are deterministic and traceable to source vouchers.

Status: Completed

Evidence: `packages/accounting/src/journal-report.ts`; deterministic chronology, totals, traceability, account/dimension scope; user confirmed local tests green.

### Step 9 — Accounting Dimension Reports
- Build dimension-member/account-dimension turnover and balance reports on Phase 11 contracts.
- Support filtering/grouping by configured accounting dimensions without hard-coding future dimension types.

Exit: dimension-based accounting balances reconcile with the same canonical Journal facts.

Status: Completed

Evidence: `packages/accounting/src/dimension-reports.ts`; generic member and Account×Member balances; user confirmed local tests green.

### Step 10 — Application Contracts, DTOs, and Query Services
- Define persistence-neutral report commands/queries, DTOs, readers/services, stable errors, paging/sorting contracts, and traceability identifiers.
- Keep future PostgreSQL/API adapters compatible with the same Application boundary.

Exit: report semantics are consumable without React, Tauri, SQLite, or HTTP dependencies.

Status: Completed

Evidence:
- `packages/accounting/src/reporting-application.ts` defines reader/snapshot/query-service contracts, paging and trace identities, and stable Application errors.
- Default query services orchestrate Steps 5–9 without duplicating report math.
- User confirmed Step 10 local Accounting typecheck/tests are green.

### Step 11 — SQLite Reporting Repository and Query Optimization
- Implement SQLite adapters for Phase 16 queries.
- Add/adjust indexes only where supported by measured/query-plan need.
- Use SQL aggregation/projection/pagination and prevent N+1/full-journal loading.

Exit: SQLite results match Application semantics and remain practical on realistic desktop datasets.

Status: Completed

Evidence:
- `packages/accounting-tauri/src/sqlite-accounting-report-data-reader.ts` implements the Step 10 reader with set-based Journal projections and generic dimension filtering.
- `apps/desktop/src-tauri/migrations/0015_accounting_report_indexes.sql` adds focused report-scope and dimension indexes.
- `packages/accounting-tauri/tests/sqlite-accounting-report-data-reader.test.ts` covers posted/reversed scope, branch/fiscal/date constraints, dimensions, opening semantics, metadata, and Journal projection.
- User confirmed Step 11 local Accounting and Accounting Tauri validation is green.

### Step 12 — Reporting Permissions, Company/Branch Scope, and Security
- Add granular reporting permissions and export permissions.
- Enforce company and branch scope at the Application boundary.
- Ensure not-found/denied behavior does not leak cross-scope accounting data.

Exit: UI visibility is not the security authority and unauthorized reporting access is deterministically rejected.

Status: Completed

Evidence:
- `packages/accounting/src/application/accounting-report-permissions.ts` defines granular report-view and export permissions.
- `packages/accounting/src/reporting-security.ts` enforces permission and company/branch scope before the inner query service/SQLite reader executes.
- Cross-scope denial uses stable non-leaking errors; all-branches scope requires explicit authorization.
- Report permissions are registered in `packages/security/src/application/default-permissions.ts`.
- `packages/accounting/tests/reporting-security.test.ts` covers permission, branch/company scope, all-branches, leakage prevention, and export authorization.
- User confirmed Step 12 local `@argin/accounting` tests and `@argin/security` typecheck are green. `pnpm --filter @argin/security test` currently executes the package placeholder `echo "Security tests are not configured yet"` and exits successfully; it is not a failing test runner and is recorded as such.

### Step 13 — Persian RTL Accounting Reports Center UI
- Add the Accounting Reports workspace using the Phase 14 design system.
- Provide compact desktop tables, loading/empty/error states, keyboard accessibility, density support, RTL, and Solar Hijri presentation.

Exit: the canonical Phase 16 reports are usable from one coherent Persian RTL report center.

Status: Completed

Evidence:
- Added `apps/desktop/src/pages/accounting/accounting-reports-page.tsx` as one Persian RTL workspace for Trial Balance, General Ledger, Subsidiary Ledger, Journal Report, and Accounting Dimension Reports.
- The page consumes the secured Application query service and does not calculate accounting balances in React.
- Added `apps/desktop/src/composition/accounting/create-accounting-report-services.ts`, composing `SqliteAccountingReportDataReader` → `DefaultAccountingReportQueryService` → `SecuredAccountingReportQueryService`; desktop branch scope derives from authenticated `branchIds` and `system.full-access`.
- Added `apps/desktop/src/pages/accounting/accounting-reports-page.css` using Phase 14 density tokens, sticky compact tables, tabular numeric rendering, constrained scroll surfaces, and responsive fallbacks.
- Gregorian persisted report dates remain query inputs; displayed dates use the Persian calendar.
- Loading, initial, empty, authorization/scope error, and data states are explicit; report tabs are permission-aware.
- Added `/accounting/reports` route and permission-aware Accounting navigation entry.
- Added `apps/desktop/tests/accounting-reports-ui-contract.test.ts` covering route/navigation visibility, RTL/Solar Hijri/density contracts, state messaging, and secured SQLite composition.
- User confirmed Step 13 local Desktop/accounting validation is green.

### Step 14 — Filters, Drill-down, and Journal Traceability UI
- Add reusable report filters and deliberate refresh/query execution.
- Support drill-down from aggregate report values to account movement and source Journal Voucher details.
- Keep presentation state separate from report business semantics.

Exit: users can move from reported totals to their accounting source without ambiguous navigation.

Status: Completed

Evidence:
- Added reusable `apps/desktop/src/features/accounting/accounting-report-filters.tsx` with Persian date range, authorized branch scope, account/descendant selection, generic dimension member filtering, zero-balance visibility, explicit Run, and Reset controls.
- Draft filter state is separated from `ExecutedReport`; editing controls never mutates an already-rendered report until the user deliberately executes again.
- Reports build the shared `AccountingReportQuery` vocabulary and continue to delegate all balance, turnover, hierarchy, dimension, reversal, and scope semantics to the secured Application service.
- UI branch selectors are restricted to authenticated `branchIds`; the all-branches option appears only when every active company branch is in scope or `system.full-access` is granted.
- Trial Balance and Subsidiary rows drill to General Ledger by deriving a new query from the exact executed query and adding an exact account filter; date, company, branch, fiscal-year, dimension, zero-balance, and other existing context is preserved.
- Accounting Dimension rows drill to the Journal Report using the same executed query plus the selected dimension-member filter.
- General Ledger and Journal rows expose `Voucher ID`/`Journal Line ID` source actions; navigation carries durable source identifiers rather than presentation text or row positions.
- Added `apps/desktop/src/pages/accounting/journal-voucher-trace-page.tsx` as a read-only source trace view. It requires `accounting.journal-vouchers.view`, loads the exact voucher, highlights the traced Journal Line, and displays both durable identifiers.
- Added `apps/desktop/src/pages/accounting/journal-vouchers-route.tsx` so report-originated trace URLs open the read-only source view while the normal Journal Voucher workspace remains unchanged for ordinary navigation.
- Added drill-down/trace styling in `accounting-reports-page.css` and `journal-voucher-trace-page.css` while retaining Phase 14 density/RTL contracts.
- Added `apps/desktop/tests/accounting-report-drilldown-contract.test.ts` covering reusable filters, explicit execution state, query-context preservation, durable source identities, route adaptation, and source-line highlighting.
- Step 14 implementation is committed; local Desktop typecheck/test validation is pending user execution.

### Step 15 — Print, Preview, Excel, and PDF Export
- Add print preview and accounting-friendly A4 output.
- Add Excel and PDF export using canonical report data/contracts.
- Preserve Persian RTL, company/fiscal context, headings, and page metadata.

Exit: supported reports can be printed/exported without recalculating accounting logic in UI/export adapters.

Status: Not started

### Step 16 — Domain and Application Report Test Matrix
- Cover opening/period/ending balances, debit/credit balances, zero balances, hierarchy aggregation, reversals, fiscal/date boundaries, branch/company scope, dimensions, unposted exclusion, sorting/pagination invariants, and stable error behavior.

Exit: report semantics are comprehensively covered independent of SQLite/Desktop.

Status: Not started

### Step 17 — SQLite/Desktop/Performance and Monorepo Validation
- Add repository/query correctness tests and Desktop regression coverage.
- Validate query plans/performance on representative larger datasets.
- Validate permissions, drill-down, print/export composition, and UI state behavior.
- Run complete repository validation required by project governance.

Exit: focused and monorepo validation is green with evidence recorded.

Status: Not started

### Step 18 — Documentation, Final Review, Merge, and Release
- Complete phase document, ADR links, README/ROADMAP/CHANGELOG/architecture/security/database/glossary updates as applicable.
- Reconcile Step Status with actual completion evidence.
- Perform final code/documentation review and branch comparison.
- Merge according to repository workflow and publish semantic release `v0.16.0` when acceptance criteria are met.

Exit: Phase 16 is documented, validated, merged, and released with no stale Step Status entries.

Status: Not started

## Change Requests

None.
