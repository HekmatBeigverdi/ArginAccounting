# Changelog

All notable changes to this project are documented in this file.

The project follows Semantic Versioning where practical during phased development.

---

## [Unreleased] — Phase 14 UI Foundation Consolidation

### Added

- Reusable Persian RTL desktop design tokens and shared form, layout, data-display, feedback, dialog, and workspace primitives
- Final desktop App Shell with grouped navigation and persisted Company/Branch/Fiscal active context
- Shared Solar Hijri date picker with Gregorian durable values, including Journal Voucher date/filter inputs
- Semantic expandable Chart of Accounts hierarchy with parent-preserving search and contained scrolling
- Accessibility/responsive contracts for keyboard landmarks, focus visibility, mixed RTL/LTR content, reduced motion, and local dense-surface overflow
- Standard loading, empty, error, success/warning/info feedback contracts with optional separated technical diagnostics

### Changed

- Consolidated Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher presentation onto the Phase 14 desktop design language
- Retired legacy Vite/Foundation global UI selectors from `App.css`
- Established a 1366 × 768 initial Tauri desktop-window baseline while preserving responsive degradation

### Tests and Validation

- Added focused UI contract coverage for shell/navigation/context, Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Persian Journal dates, Accounting workspaces, accessibility/responsive behavior, desktop window baseline, and standardized feedback states
- Full frozen install, lint, typecheck, test, build, documentation-index, and diff validation is the Step 13 release gate and must be recorded from executable repository evidence before Step 13 is marked complete

### Scope Boundary

- Phase 14 presentation work does not add Journal posting, approval, locking, reversal, replacement, voiding, or finalization behavior; Journal Lifecycle remains Phase 15
- Accounting reports remain Phase 16

---

## [0.13.0] - 2026-08-17

### Added

- Persisted Draft Journal Voucher aggregate and ordered Journal Lines with strict double-entry invariants
- Account/fiscal eligibility and reusable Phase 11 accounting-dimension assignment validation
- Company + fiscal year + optional branch Journal Number Series integration
- Request-id idempotency, retry replay, optimistic concurrency, and post-commit integration events
- Read/search/detail Application models and journal-backed account/dimension usage detection
- Persian RTL Journal Voucher workspace with Solar Hijri dates, Iranian Rial amounts, real line table, and dynamic accounting-dimension columns

### Database

- Added migration `0013_journal_vouchers.sql`
- Added `journal_vouchers`, `journal_lines`, and `journal_line_dimension_assignments`
- Added branch-aware and branchless voucher-number uniqueness, request-id uniqueness, account/dimension referential constraints, and query/usage indexes
- Added cascade behavior for voucher child rows
- Added repository-level persisted header-total drift detection during aggregate rehydration

### Security and Audit

- Added Journal Voucher view, create, update-draft, delete-draft, and history permissions
- Enforced authorization at the Application boundary
- Added authorization-denied security audit evidence
- Published create/update/delete success events only after Journal commit
- Suppressed duplicate success events during idempotent replay and all success events on validation/rollback/stale-version failure

### Tests and Validation

- Added Domain/Application edge coverage for malformed/unbalanced vouchers, locked fiscal periods, inactive/non-postable accounts, missing required dimensions, cross-company mutation, retry, rollback, and stale versions
- Added SQLite repository and migration regression coverage for round-trip persistence, optimistic concurrency, branchless uniqueness, request-id uniqueness, cascade behavior, usage detection, and persisted-total drift
- Added Desktop presenter/composition and Journal UI regression-contract coverage
- Focused validation was executed locally after the final Desktop test correction and confirmed passing by the repository owner
- Full frozen install, lint, typecheck, test, production build, documentation-index, and diff validation passed before release; detailed evidence is recorded in the Phase 13 fixed implementation plan

### Deferred

- Posting, approval, locking, reversal, replacement, voiding, and controlled amendment: Phase 15
- Trial balance, general ledger, subsidiary ledger, and financial reporting: Phase 16
- PostgreSQL/API and synchronization adapters: future Argin Bridge delivery

---

## [0.12.0] - 2026-08-08

### Added

- Versioned service, trading, and manufacturing coding-template catalogs
- Deterministic preview, conflict analysis, atomic application, and application history
- Retry-safe request identities, item mappings, fingerprints, and post-commit integration events
- Non-destructive additive upgrade comparison with local-drift protection
- Versioned Excel workbook contract, cell-level validation, preview, and atomic import
- Persian RTL coding-template workspace with recommendation, tree preview, history, upgrade, and import experiences

### Database

- Added migration `0012_coding_templates.sql`
- Added company activity-type compatibility with existing companies backfilled to `custom`
- Added normalized template/version content, application mapping/history, and import-batch persistence
- Added durable uniqueness, lifecycle, provenance, idempotency, referential, and synchronization-oriented constraints and indexes

### Security and Audit

- Added coding-template view, lifecycle, preview, apply, upgrade, import, and history permissions
- Restricted built-in catalog mutation to privileged system administration
- Preserved actor, company, source, correlation, causation, version, fingerprint, and request context
- Suppressed success events on transaction failure, rollback, and idempotent replay

### Tests and Validation

- Accounting focused tests passed: 192
- SQLite Accounting Adapter focused tests passed: 39
