# Changelog

All notable changes to this project are documented in this file.

The project follows Semantic Versioning where practical during phased development.

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
