# Phase 16 — Step 16 — Domain and Application Report Test Matrix

## Purpose

This matrix records executable Domain/Application coverage for Phase 16 accounting-report semantics. SQLite, Desktop, query-plan, and performance validation are intentionally deferred to Step 17.

## Matrix

| Acceptance axis | Executable evidence | Covered semantics |
| --- | --- | --- |
| Opening / period / ending | `packages/accounting/tests/accounting-report-balance.test.ts` | Opening facts are strictly before `fromDate`; period facts include both date boundaries; ending equals opening plus debit minus credit. |
| Debit / credit balances | `packages/accounting/tests/accounting-report-balance.test.ts` | Positive net projects to debit, negative net projects to credit, including credit opening and ending balances. |
| Zero-balance policy | `packages/accounting/tests/trial-balance.test.ts` | Fully unused rows are omitted by default, optionally included, while accounts with real turnover remain visible even when ending balance returns to zero. |
| Hierarchy aggregation | `accounting-report-balance.test.ts`, `general-ledger.test.ts`, `trial-balance.test.ts` | Parent totals derive from distinct posting descendants and do not double-count synthetic parent values. |
| Reversal semantics | `accounting-report-balance.test.ts`, `general-ledger.test.ts`, `journal-report.test.ts` | Original posted fact and separate posted inverse remain independently traceable and net deterministically. |
| Date boundaries | `accounting-report-balance.test.ts`, `journal-report.test.ts` | `fromDate <= date <= toDate`; facts before `fromDate` contribute only to opening; facts after `toDate` are excluded. |
| Fiscal boundaries | `accounting-report-balance.test.ts`, `general-ledger.test.ts` | Fiscal year is a base scope; selected fiscal period applies to movement without discarding valid prior-period opening facts. |
| Company / branch / currency scope | `accounting-report-balance.test.ts`, `general-ledger.test.ts`, `reporting-security.test.ts` | Foreign company, unauthorized/exact other branch, branchless exact-scope facts, and incompatible currency facts cannot affect the report. |
| Accounting dimensions | `dimension-reports.test.ts`, `accounting-report-balance.test.ts`, `journal-report.test.ts` | Generic dimension member filters compose with branch/fiscal/account scope; member and account-member balances derive from the same posted facts. |
| Unposted exclusion | `accounting-report-balance.test.ts`, `general-ledger.test.ts`, `journal-report.test.ts`, `dimension-reports.test.ts` | `isPostedFact=false` never affects final report balances or details. |
| Stable ordering | `general-ledger.test.ts`, `journal-report.test.ts` | Detail ordering is deterministic by accepted voucher/date/line identity rules and remains traceable by durable voucher/line IDs. |
| Pagination invariants | `reporting-application.test.ts` | Paging is applied after canonical Journal ordering; later pages preserve order, totals remain canonical, and total-items/pages/has-next metadata remain stable. |
| Stable errors | `accounting-report-query.test.ts`, `accounting-report-balance.test.ts`, `general-ledger.test.ts`, `reporting-application.test.ts`, `reporting-security.test.ts`, `dimension-reports.test.ts` | Invalid query/fact/detail/snapshot, reader failure, permission denial, and scope denial use deterministic error contracts. |
| Trace identity | `reporting-application.test.ts`, `general-ledger.test.ts`, `journal-report.test.ts` | Voucher ID and Journal Line ID survive projection and are immutable durable drill-down identities. |

## Dimension Multiplicity Boundary

Phase 11 allows dimension types to declare `allowMultipleMembers`. Phase 16 does not define allocation weights or proportional distribution of one journal-line amount across multiple members of the same dimension type. Step 16 therefore does not invent an allocation rule or assert that summing independently grouped member rows must equal the ledger when one fact intentionally carries multiple members. Any future allocation/reconciliation rule requires an explicit accounting semantic decision rather than a test-only assumption.

## Step 16 Validation

Run from the repository root:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
```

Step 16 is complete when the executable matrix is present and the Accounting package validation is green. Repository/SQLite/Desktop/performance validation remains Step 17 scope.
