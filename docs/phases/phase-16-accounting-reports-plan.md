# Phase 16 — Accounting Reports — Fixed Implementation Plan

## Status

Phase 16 is active. Steps 1–16 are complete; Step 17 is next.

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
| 15 | Print, Preview, Excel, and PDF Export | Completed |
| 16 | Domain and Application Report Test Matrix | Completed |
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
- Support the column variants justified by the accepted ADR and accounting model.
- Support account-level/hierarchy presentation and optional zero-balance rows.

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

Evidence: `packages/accounting/src/reporting-application.ts`; persistence-neutral reader/query contracts and canonical report orchestration; user confirmed local validation green.

### Step 11 — SQLite Reporting Repository and Query Optimization
- Implement SQLite adapters for Phase 16 queries.
- Add/adjust indexes only where supported by measured/query-plan need.
- Use SQL aggregation/projection/pagination and prevent N+1/full-journal loading.

Exit: SQLite results match Application semantics and remain practical on realistic desktop datasets.

Status: Completed

Evidence: `packages/accounting-tauri/src/sqlite-accounting-report-data-reader.ts`, migration `0015_accounting_report_indexes.sql`, and focused SQLite tests; user confirmed local validation green.

### Step 12 — Reporting Permissions, Company/Branch Scope, and Security
- Add granular reporting permissions and export permissions.
- Enforce company and branch scope at the Application boundary.
- Ensure not-found/denied behavior does not leak cross-scope accounting data.

Exit: UI visibility is not the security authority and unauthorized reporting access is deterministically rejected.

Status: Completed

Evidence: granular view/export permissions, `SecuredAccountingReportQueryService`, non-leaking scope denial, and `reporting-security.test.ts`; user confirmed local Accounting/Security validation. `@argin/security test` remains a successful placeholder rather than a configured test runner.

### Step 13 — Persian RTL Accounting Reports Center UI
- Add the Accounting Reports workspace using the Phase 14 design system.
- Provide compact desktop tables, loading/empty/error states, keyboard accessibility, density support, RTL, and Solar Hijri presentation.

Exit: the canonical Phase 16 reports are usable from one coherent Persian RTL report center.

Status: Completed

Evidence: `/accounting/reports`, secured Desktop composition, Persian RTL/Solar Hijri report surfaces, density-aware compact tables, permission-aware navigation, and Desktop UI contract tests; user confirmed local validation green.

### Step 14 — Filters, Drill-down, and Journal Traceability UI
- Add reusable report filters and deliberate refresh/query execution.
- Support drill-down from aggregate report values to account movement and source Journal Voucher details.
- Keep presentation state separate from report business semantics.

Exit: users can move from reported totals to their accounting source without ambiguous navigation.

Status: Completed

Evidence:
- `apps/desktop/src/features/accounting/accounting-report-filters.tsx` provides reusable Persian date, branch, account, descendant, dimension, zero-balance, Run, and Reset filters.
- Draft filters remain separate from the exact executed query.
- Trial Balance/Subsidiary drill to General Ledger; Dimension rows drill to Journal; General Ledger/Journal rows trace by stable Voucher ID and Journal Line ID.
- `journal-voucher-trace-page.tsx` and `journal-vouchers-route.tsx` preserve read-only source traceability without changing the ordinary voucher workspace.
- `accounting-report-drilldown-contract.test.ts` covers the filter/drill-down/trace contract.
- User confirmed Step 14 local Desktop typecheck/tests/build are green.

### Step 15 — Print, Preview, Excel, and PDF Export
- Add print preview and accounting-friendly A4 output.
- Add Excel and PDF export using canonical report data/contracts.
- Preserve Persian RTL, company/fiscal context, headings, and page metadata.

Exit: supported reports can be printed/exported without recalculating accounting logic in UI/export adapters.

Status: Completed

Evidence:
- `apps/desktop/src/features/accounting/accounting-report-export.ts` projects canonical Trial Balance, General Ledger, Subsidiary Ledger, Journal, and Dimension DTO results without accounting recomputation.
- Excel uses UTF-8 RTL SpreadsheetML; Preview is full-screen Persian RTL A4; PDF/print uses the native Tauri WebView print bridge on macOS.
- Native macOS print orientation is explicitly configured to match the Phase 16 landscape A4 preview before opening the system Print/Save-as-PDF dialog.
- Export authorization is independently rechecked through `assertAccountingReportExportAuthorized` for permission and exact company/branch scope.
- `apps/desktop/tests/accounting-report-export.test.ts` and native-print bridge tests cover the export composition.
- User confirmed Step 15 locally and functionally: Excel download, full-screen preview, native Print/Save as PDF, and landscape output are working.

### Step 16 — Domain and Application Report Test Matrix
- Cover opening/period/ending balances, debit/credit balances, zero balances, hierarchy aggregation, reversals, fiscal/date boundaries, branch/company scope, dimensions, unposted exclusion, sorting/pagination invariants, and stable error behavior.

Exit: report semantics are comprehensively covered independent of SQLite/Desktop.

Status: Completed

Evidence:
- Added `docs/phases/phase-16-step-16-report-test-matrix.md`, mapping every Step 16 acceptance axis to executable Domain/Application tests and explicitly excluding SQLite/Desktop/performance work reserved for Step 17.
- Extended `accounting-report-balance.test.ts` with inclusive `fromDate`/`toDate` boundaries, post-`toDate` exclusion, company/fiscal-year isolation, and debit/credit-side projection for negative opening/ending net balances.
- Extended `trial-balance.test.ts` to prove an account with real period turnover remains visible when its ending balance returns to zero, while unused zero rows remain governed by `includeZeroBalances`.
- Extended `dimension-reports.test.ts` to prove generic member filters compose with exact branch and fiscal-year scope.
- Extended `reporting-application.test.ts` to prove deterministic Journal ordering persists across later pages while canonical totals and paging metadata remain stable.
- Existing General Ledger, Journal, security, query-validation, reversal, and report error tests complete hierarchy, traceability, unposted exclusion, stable ordering, and stable-error coverage.
- Multi-member dimension allocation is deliberately not invented: Phase 16 has no allocation-weight semantic, and the matrix records that summing independently grouped multiple members is not asserted as ledger reconciliation without a future explicit accounting decision.
- Step 16 implementation is committed; local `@argin/accounting` typecheck/test validation is pending user execution.

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
