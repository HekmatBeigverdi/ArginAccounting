# Phase 11 — Accounting Dimensions

## Status

Implemented and validated. Pending merge into `develop` and release.

## Overview

This phase introduces company-scoped accounting dimensions as independent analytical axes outside the Chart of Accounts hierarchy. It delivers dimension types, hierarchical or flat members, account-specific requirement policies, assignment validation, SQLite persistence, protected application workflows, audit events, dynamic selectors, and a Persian RTL desktop workspace.

## Objectives

- Preserve the three-level Group, General, and Subsidiary account hierarchy
- Model reusable detailed classifications independently from accounts
- Support flat and hierarchical dimension types
- Control dimension requirements per posting account
- Validate line assignments against scope, lifecycle, effective dates, and multiplicity
- Provide paged, searchable SQLite repositories and selectors
- Enforce permissions, auditability, transactions, and optimistic concurrency
- Deliver Persian RTL management and selection experiences

## Scope

### Included

- Company-scoped dimension types with manual, system, or module provenance
- Dimension members with optional hierarchy and Gregorian effective-date storage
- Account-dimension policies: `required`, `optional`, and `forbidden`
- Assignment-validation contracts for future journal lines
- Dynamic selector contracts and SQLite services
- Create, edit, status-change, delete, search, and policy-management workflows
- Safe deletion based on children, policies, and usage readers
- SQLite migration, repositories, query escaping, indexes, and optimistic concurrency
- Application-boundary permissions and post-commit audit events
- Persian RTL desktop page, policy workspace, and dynamic selector
- Domain, Application, Repository, Migration, and Desktop tests

### Excluded

- Persisted Journal Vouchers and Journal Lines: Phase 13
- Production journal-backed dimension-usage detection: Phase 13 and later
- Service, trading, and manufacturing coding templates: Phase 12
- Automatic Party, Project, Cost Centre, Contract, or other module adapters: their owning phases
- Historical policy snapshots on posted journal lines: Journal Voucher design

## Architecture

Dimensions are independent of the account tree. `AccountingDimensionType`, `AccountingDimensionMember`, and `AccountDimensionPolicy` are separate versioned aggregates. Application Services own authorization, scope validation, transaction orchestration, concurrency checks, safe deletion, and event publication. Domain contracts do not depend on React, Tauri, or SQLite.

The assignment validator is deterministic and reusable by the future Journal Voucher Engine. The selector contract returns only members that are valid for the requested company, account, dimension policy, search text, and document date.

## Domain Model

### Dimension Type

- Unique normalized code per company
- Persian name and optional English name
- `hierarchical` and `allowMultipleMembers` behavior flags
- `active` or `inactive` status
- Manual, system, or module source provenance
- Display order and optimistic-concurrency version

### Dimension Member

- Unique normalized code per company and dimension type
- Optional parent in the same company and type
- Parent allowed only when the type is hierarchical
- `active` or `inactive` status
- Optional `validFrom` and `validTo` stored as Gregorian `YYYY-MM-DD`
- Manual, system, or module source provenance
- Display order and optimistic-concurrency version

### Account-Dimension Policy

Exactly one policy may exist for a company, active account, and dimension type. The requirement is:

| Requirement | Meaning |
|---|---|
| `required` | At least one valid member must be assigned. |
| `optional` | Assignment may be omitted; supplied members must still be valid. |
| `forbidden` | No member of the dimension may be assigned. |

Assignment validation rejects duplicate policies or assignments, undefined policies, inactive or cross-company types and members, type mismatches, repeated members, disallowed multiple members, invalid document dates, and members outside their effective dates.

## Application Services

`AccountingDimensionsService` provides:

- create, update, activate/deactivate, retrieve, search, and delete operations for types and members;
- create, update, search, and delete operations for account-dimension policies;
- company and aggregate-scope validation;
- duplicate-code prevention and parent validation;
- account eligibility checks for policy management;
- safe-deletion checks through `AccountingDimensionUsageReader`;
- expected-version checks and transaction boundaries;
- audit-event publication only after successful commit.

The SQLite assignment-validation and selector services implement the reusable domain contracts without exposing SQL to callers.

## Data and Migrations

Migration: `apps/desktop/src-tauri/migrations/0011_accounting_dimensions.sql`

Tables:

- `accounting_dimension_types`
- `accounting_dimension_members`
- `account_dimension_policies`

Durable constraints enforce company-scoped uniqueness, same-company and same-type foreign keys, valid codes and enumerations, non-negative display order, effective-date ordering, non-self parents, source provenance, policy uniqueness, and versions greater than or equal to one. Delete behavior is restrictive so referenced business classifications cannot disappear implicitly.

Indexes cover company/status ordering, names, provenance, member parents and effective dates, plus account- and type-oriented policy lookup.

## Security and Permissions

- `accounting.dimensions.view`
- `accounting.dimensions.create`
- `accounting.dimensions.update`
- `accounting.dimensions.change-status`
- `accounting.dimensions.delete`
- `accounting.dimensions.manage-policies`

`system.full-access` covers all dimension operations. UI gates supplement but do not replace Application Service authorization.

Mutation events use the `accounting.dimension-type.*`, `accounting.dimension-member.*`, and `accounting.dimension-policy.*` namespaces. They preserve company, actor, source, correlation/causation context, aggregate version, and before/after state. Events are published after a successful transaction.

## User Interface

The desktop route `/accounting/dimensions` provides:

- Persian RTL type and member management
- company-scoped search and filtering
- flat or hierarchical member display
- create, edit, status, and safe-delete actions
- account-dimension policy management
- dynamic dimension selection driven by the chosen account and document date
- actionable Persian validation and concurrency messages

Dates are presented according to Iranian localization conventions while durable effective dates remain Gregorian ISO values.

## Testing

Coverage includes:

- Domain invariants and normalization
- assignment-validation scenarios
- Application Service success, authorization, scope, deletion, policy, and concurrency paths
- SQLite record mapping, escaped searches, filters, CRUD, and stale-version conflicts
- migration constraints and required indexes
- selector and usage-reader services
- Persian presenters, policies, errors, and selector behavior

## Validation Evidence

The final Phase 11 branch was validated with a frozen install and fresh Monorepo checks:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Results recorded in Step 16:

- Frozen install: 21 workspaces passed
- Lint: passed without warnings
- Typecheck: 19/19 tasks passed
- Tests: 18/18 workspace tasks passed
- Build: 19/19 tasks passed
- Phase 11 focused suites: Accounting 131, SQLite Adapter 27, Desktop 26 tests passed
- `git diff --check`: passed
- Web build no longer depends on downloading unused remote fonts

## Documentation Impact

- Added this phase record and ADR-0011
- Updated Roadmap, Changelog, documentation and phase indexes
- Updated architecture and module registries
- Updated accounting, database, security, and glossary references

## Related ADRs

- [ADR-0010 — Chart of Accounts Model](../adr/ADR-0010-chart-of-accounts-model.md)
- [ADR-0011 — Independent Accounting Dimensions](../adr/ADR-0011-independent-accounting-dimensions.md)

## Exit Criteria

- Independent dimension Domain and Application model implemented
- Assignment validation and selector contracts implemented
- SQLite migration, repositories, and services implemented
- Permissions, audit events, and optimistic concurrency implemented
- Persian RTL desktop management and selection UI implemented
- Focused and full Monorepo validation passed
- Canonical documentation updated
- Remaining delivery actions: merge to `develop`, tag and release when approved

## Next Phase

Phase 12 — Coding Templates.
