# Changelog

All notable changes to this project are documented in this file.

The project follows Semantic Versioning where practical during phased development.

---

## [0.15.0] - 2026-08-26

### Added

- Controlled five-state Journal Voucher lifecycle: Draft, Pending Approval, Approved, Posted, and Reversed
- Reusable Approval integration with explicit submit, approve, reject, return-to-draft, and cancel coordination
- Final posting policy with current account, dimension, fiscal, balance, content-version, and Approval evidence revalidation
- Controlled amendment and immutable reversal/replacement lineage
- Granular lifecycle permissions with default self-approval segregation of duties
- Migration `0014_journal_lifecycle.sql` with authoritative lifecycle status and durable Approval, Posting, Amendment, and Reversal evidence
- SQLite lifecycle Unit of Work adapters with optimistic concurrency, atomic multi-write persistence, and request-id idempotency
- Lifecycle Audit evidence, post-commit Integration Events, and operational in-app notifications
- Persian RTL lifecycle status, confirmations, traceability, business failure guidance, and expandable technical diagnostics
- Shared Desktop data invalidation so Journal, Approval, Audit, User, Role, and sibling management views refresh after successful mutations without navigation/reload

### Changed

- Journal ordinary update/delete remains Draft-only; non-Draft records are locked by Application policy
- Approval and posting remain separate decisions; approval never auto-posts a Journal Voucher
- Posted/reversed accounting facts are immutable in place; correction uses separate inverse vouchers and lineage
- Lifecycle actions reload the latest persisted snapshot before consequential confirmation to preserve optimistic concurrency without stale UI versions
- Company and Branch references in Journal detail/lifecycle presentation resolve to user-facing labels instead of raw identifiers
- Desktop Draft edit/delete/submit actions are executable and use internal confirmation modals instead of native `window.confirm`
- Post-commit effect failures are stage-aware (`audit`, `event`, `notification`) and cannot falsely report a committed business transaction as rolled back
- Lifecycle Audit persistence avoids an unnecessary nested post-commit transaction
- Lifecycle Notification types use the required `accounting.` source-module prefix

### Tests and Validation

- Added exhaustive Domain/Application lifecycle state-action matrix coverage
- Added focused Approval, Posting, Amendment, Reversal, authorization/SoD, idempotency, stale-version, and post-commit effect tests
- Added real SQLite migration/constraint and optimistic-concurrency regression coverage
- Added Desktop regression contracts for permissions, executable actions, confirmation UX, stale-snapshot refresh, auto-invalidation, post-commit diagnostics, and canonical handler/UoW wiring
- Added real `DefaultNotificationService` validation so notification source-module/type-prefix compatibility is tested instead of hidden by mocks
- Step 17 focused/full validation is recorded as user-confirmed local execution
- Step 18 manual runtime acceptance exercised real Journal creation, submit-for-approval, separate-user approval, lifecycle version/status updates, Approval/Audit integration behavior, and automatic UI refresh; runtime defects found during acceptance were corrected before merge

### Merge and Release

- Phase branch merged into `develop` through PR #10 with merge commit `e43f8eb5e50dfe7fcce12f70ef28b79a85ffdb62`
- Final semantic tag and GitHub Release: `v0.15.0`
- Phase 16 — Accounting Reports is the next implementation target

### Deferred

- Trial Balance, General Ledger, Subsidiary Ledger, and other Accounting Reports: Phase 16
- Automatic posting from future operational modules: later owning phases
- PostgreSQL/.NET synchronization adapters: future Argin Bridge delivery

---

## [0.14.0] - 2026-08-22

### Added

- Reusable Persian RTL desktop design tokens and shared form, layout, data-display, feedback, dialog, and workspace primitives
- Final desktop App Shell with grouped navigation and persisted Company/Branch/Fiscal active context
- Shared Solar Hijri date picker with Gregorian durable values, including Journal Voucher date/filter inputs
- Semantic expandable Chart of Accounts hierarchy with parent-preserving search and contained scrolling
- Accessibility/responsive contracts for keyboard landmarks, focus visibility, mixed RTL/LTR content, reduced motion, and local dense-surface overflow
- Standard loading, empty, error, success/warning/info feedback contracts with optional separated technical diagnostics
- Global three-level display density preference: compact, comfortable, and spacious, with comfortable as the default and local persistence

### Changed

- Consolidated Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher presentation onto the Phase 14 desktop design language
- Retired legacy Vite/Foundation global UI selectors from `App.css`
- Established a 1366 × 768 initial Tauri desktop-window baseline while preserving responsive degradation
- Applied shared density tokens and contained scrolling to operational accounting workspaces and the Chart of Accounts hierarchy

### Tests and Validation

- Added focused UI contract coverage for shell/navigation/context, Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Persian Journal dates, Accounting workspaces, accessibility/responsive behavior, desktop window baseline, standardized feedback states, and display density
- Frozen install, Desktop typecheck/test/build, full monorepo lint/typecheck/test/build, documentation-index generation, and diff validation were completed during the Phase 14 release gate

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
- Tauri SQLite transaction lifecycle tests passed: 4
- Desktop and Phase 10/11 regression tests passed: 36
- Full Step 18 validation evidence is recorded in the Phase 12 fixed implementation plan

### Deferred

- Persisted Journal Vouchers and Journal Lines: Phase 13
- PostgreSQL/API and synchronization adapters: future Argin Bridge delivery
- Destructive account replacement or automatic local override: intentionally excluded

---

## [0.11.0] - Unreleased

### Added

- Company-scoped accounting dimension types and members independent from the Chart of Accounts
- Flat and hierarchical dimensions with single- or multiple-member selection
- Effective-dated dimension members with manual, system, or module provenance
- Required, optional, and forbidden account-dimension policies
- Reusable assignment validation and dynamic selector contracts
- SQLite repositories, usage reader, validation service, and selector service
- Persian RTL dimension and policy management workspace
- Dynamic Persian dimension selector and actionable error presentation

### Database

- Added `accounting_dimension_types`
- Added `accounting_dimension_members`
- Added `account_dimension_policies`
- Added migration `0011_accounting_dimensions.sql`
- Added company/type scope, hierarchy, effective-date, uniqueness, provenance, and concurrency constraints

### Security and Audit

- Added dimension view, create, update, status, delete, and policy-management permissions
- Enforced company scope and authorization at the Application Service boundary
- Added type, member, and policy lifecycle audit events with before/after state
- Preserved actor, source, correlation, causation, and aggregate-version context

### Tests and Validation

- Accounting focused tests passed: 131
- SQLite Adapter focused tests passed: 27
- Desktop focused tests passed: 26
- Frozen install passed for 21 workspaces
- Monorepo lint passed without warnings
- Monorepo typecheck passed: 19/19 tasks
- Monorepo tests passed: 18/18 tasks
- Monorepo build passed: 19/19 tasks

### Deferred

- Service, trading, and manufacturing coding templates: Phase 12
- Persisted Journal Vouchers, Journal Lines, and dimension assignments: Phase 13
- Production journal-backed dimension-usage detection: Phase 13 and later
- Master-data-backed dimension adapters: their owning phases

---

## [0.10.0] - Unreleased

### Added

- Company-scoped three-level Chart of Accounts: Group, General, and Subsidiary
- Stable account identity with normalized company-unique numeric codes
- Company coding settings and hierarchical-code policy
- Explicit account nature, normal balance, statement, cash-flow, and management classifications
- Account create, update, move, status, and delete workflows
- Account source provenance for manual, coding-template, and Excel-import creation
- `AccountUsageReader` boundary for future journal-backed usage detection
- Persian RTL Chart of Accounts desktop workspace
- Company selector, tree search, filtering, and coding-settings UI
- Actionable Persian accounting error messages

### Database

- Added `account_coding_settings`
- Added `accounts`
- Added `account_management_tags`
- Added migration `0010_chart_of_accounts.sql`
- Added company-scoped code uniqueness, same-company hierarchy, classification checks, and optimistic-concurrency versions

### Security and Audit

- Added view, create, update, move, status, settings, and delete permissions
- Enforced authorization at the Application Service boundary
- Added account and coding-settings audit events
- Preserved actor, company, source, correlation, and causation context
- Recorded complete pre-deletion snapshots after successful transactional deletion

### Change Policies

- Prevented deletion of accounts with children or financial activity
- Allowed physical deletion only for unused leaf accounts
- Controlled used-account code changes through company settings
- Prevented deactivation of parents with active children
- Rejected stale updates and deletes through optimistic concurrency

### Tests and Validation

- Accounting tests passed: 63
- Accounting Tauri SQLite tests passed: 8
- Desktop tests passed: 12
- Accounting, SQLite adapter, Security, and Desktop builds passed
- Monorepo lint and type checking passed
- Local validation was repeated successfully after commit `eb86584`

### Deferred

- Accounting dimensions and detailed accounts: Phase 11
- Service, trading, and manufacturing coding templates: Phase 12
- Template versioning and atomic Excel import: Phase 12
- Production Journal Line usage adapter: Phase 13 and later

---

## [0.9.0] - 2026-07-28

### Added

- Typed Event Bus
- Money value objects and currency policy
- Command and Query buses
- Structured filtering, sorting, projection, and pagination
- Number Series Engine
- Metadata Engine
- Notification contracts and delivery infrastructure
- Plugin contracts and compatibility policies
- Shared Data Access and Unit of Work contracts
- Standard Optimistic Concurrency
- Persistent Background Jobs

### Database

- Added persistent SQLite Background Job storage
- Added persistent SQLite Notification storage
- Added company, branch, actor, and correlation context to Background Jobs
- Added migrations:
  - `0007_background_jobs.sql`
  - `0008_notifications.sql`
  - `0009_background_job_context.sql`

### Desktop

- Connected Platform Infrastructure to the desktop composition root
- Replaced in-memory notification storage with SQLite
- Added persistent Background Job processing

### Security

- Background Jobs preserve company and branch scope
- Background Jobs preserve actor identity
- Correlation IDs are preserved during queued execution
- Context values are validated before persistence

### Tests

- Added Query Framework validation tests
- Added SQLite Notification Store integration tests
- Added Background Job context and migration tests
- Verified compatibility with existing Background Job records

### Validation

- Platform tests passed: 131
- Platform Tauri tests passed: 27
- Monorepo lint, typecheck, tests, and build passed
- Rust formatting, Clippy, tests, and build passed

---

## [0.8.0] - Unreleased

### Added

- Audit domain with immutable audit entries
- Audit actors, actions, outcomes, sources, scopes, targets, metadata, and correlation IDs
- Before and after snapshots with sensitive-value sanitization
- Approval request domain and status transitions
- Append-only approval history
- Approval create, submit, approve, reject, return-to-draft, cancel, and comment use cases
- Permission contracts and application-level authorization
- Atomic Approval + History + Audit persistence
- Optimistic concurrency using approval request versions
- SQLite audit and approval repositories
- SQLite audit Unit of Work with mutex-protected transactions
- Audit and approval query builders and pagination
- Desktop audit composition root
- Authenticated session provider and permission injection
- Persian approval request list and details pages
- Persian audit entry list and details pages
- Approval timeline and audit snapshot viewer
- Application tests for permissions, transitions, atomic writes, and snapshot sanitization
- Unit of Work tests for commit, rollback, rollback failure, and transaction serialization

### Database

- Added `audit_entries`
- Added `approval_requests`
- Added `approval_history`
- Added indexes for audit and approval queries
- Added approval request `version` for optimistic concurrency
- Added migrations:
  - `0005_audit_and_approval.sql`
  - `0006_approval_optimistic_concurrency.sql`

### Security

- Added permissions for viewing and recording audit entries
- Added permissions for creating, viewing, submitting, approving, rejecting, returning, cancelling, and commenting on approval requests
- Added support for `system.full-access` in audit authorization
- Authorization is enforced at the application boundary

### Desktop

- Added `/approval/requests`
- Added `/approval/requests/:id`
- Added `/audit/entries`
- Added `/audit/entries/:id`
- Added approval and audit navigation items
- Added loading and error states for audit composition startup

### Architecture

- Added `@argin/audit`
- Added `@argin/audit-tauri`
- Added database executor adapter for desktop database compatibility
- Added repository, clock, ID generator, authorizer, and Unit of Work contracts
- Kept domain and application layers independent from React, Tauri, and SQLite
- Added transaction orchestration for multi-record workflow operations

### Tests

- Approval transition matrix
- Invalid transition protection
- Permission denial before transaction execution
- Atomic approval creation
- Approval submission and version increment
- Audit recording and query forwarding
- Sensitive snapshot sanitization
- SQLite transaction commit and rollback
- Aggregate error when rollback also fails
- Mutex serialization of concurrent transactions

### Known Validation Requirement

The following commands must pass locally before the phase is merged and released:

```bash
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit test
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/audit-tauri test
pnpm --filter @argin/desktop typecheck
pnpm typecheck
pnpm test
pnpm build
cd apps/desktop/src-tauri && cargo check
```

---

## [0.7.0] - Unreleased

### Added

- Local user management
- Role management
- Permission catalog
- Role permission assignment
- User role assignment
- User branch access assignment
- Local login page
- Argon2id password hashing through Tauri commands
- Failed login tracking and temporary account locking
- Security bootstrap on desktop startup
- System administrator role
- Initial administrator application service

### Database

- Added `users`
- Added `roles`
- Added `permissions`
- Added `user_roles`
- Added `role_permissions`
- Added `user_branch_access`

### Security

- Passwords are never stored in plain text
- Authentication and authorization are separated
- Permissions are assigned through roles
- Branch access is assigned directly to users
- The system administrator role receives all active permissions
- No hard-coded production administrator password is introduced

### Desktop

- Added `/login`
- Added `/security/users`
- Added `/security/roles`
- Added `/security/permissions`

### Architecture

- Added security domain and application services
- Added SQLite security repositories
- Added Tauri password hashing commands
- Added desktop security bootstrap provider
