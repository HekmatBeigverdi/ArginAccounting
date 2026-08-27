# Phase 16 — Step 12 Security Evidence

## Step

12 — Reporting Permissions, Company/Branch Scope, and Security

## Status

Implementation complete; local validation pending user confirmation.

## Evidence

- Added `packages/accounting/src/application/accounting-report-permissions.ts` with granular permissions for Trial Balance, General Ledger, Subsidiary Ledger, Journal Report, Accounting Dimension Reports, and report export.
- Added `packages/accounting/src/reporting-security.ts` with `SecuredAccountingReportQueryService` as an Application-layer security decorator over the persistence-neutral report query service.
- Read authorization is enforced before the inner query service/reader is invoked.
- Company scope is mandatory and checked before report execution.
- A specific branch query requires explicit access to that branch within the requested company.
- A company-wide/all-branches query requires explicit all-branches access; access to one branch never widens into company-wide reporting.
- Scope denial uses the stable `report.scope-denied` error without returning requested company/branch identifiers in error details.
- Missing report permission uses the stable `report.unauthorized` error.
- Added `assertAccountingReportExportAuthorized` so Step 15 export adapters must enforce a separate export permission plus the same company/branch scope.
- Registered all Phase 16 report permissions in `packages/security/src/application/default-permissions.ts`.
- Added `packages/accounting/tests/reporting-security.test.ts` covering permission denial before execution, authorized branch access, cross-branch denial without scope leakage, explicit all-branches enforcement, and independent export authorization.
- Added public package exports for `@argin/accounting/reporting-security` and `@argin/accounting/accounting-report-permissions`.
- User confirmed Step 11 local Accounting and Accounting Tauri validation is green before Step 12 started.

## Exit Criteria

UI visibility is not the security authority. Unauthorized report reads are rejected at the Application boundary before infrastructure execution, and export has an independent permission gate. Company/branch access does not widen implicitly and denied scopes do not disclose cross-scope identifiers.
