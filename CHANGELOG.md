# Changelog

All notable changes to this project are documented in this file.

The project follows Semantic Versioning where practical during phased development.

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
- Added temporary development navigation to the login page

### Architecture

- Added security domain and application services
- Added SQLite security repositories
- Added Tauri password hashing commands
- Added desktop security bootstrap provider
