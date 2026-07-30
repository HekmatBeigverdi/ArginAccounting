# Phase 10 — Chart of Accounts

## Status

Implemented and validated. Pending merge into `develop` and release.

## Overview

This phase introduces the company-scoped Chart of Accounts for Iranian corporate accounting. It provides a stable three-level operational hierarchy, explicit accounting classifications, company coding policies, SQLite persistence, protected application workflows, audit events, and a Persian RTL desktop workspace.

## Objectives

- Model Group, General, and Subsidiary accounts
- Preserve stable account identity independently from mutable codes
- Enforce company-scoped hierarchy and code rules
- Store explicit accounting nature and report classifications
- Provide company-specific coding settings
- Implement SQLite repositories and optimistic concurrency
- Protect sensitive operations with permissions and audit events
- Deliver a Persian RTL desktop workspace
- Prepare Phase 11 Accounting Dimensions and Phase 12 Coding Templates

## Scope

### Included

- Three-level account hierarchy: Group, General, Subsidiary
- Persian and Arabic digit normalization for account codes
- Company-scoped code uniqueness
- Company coding settings and hierarchical-code enforcement
- Account nature, normal balance, statement classification, cash-flow classification, and management tags
- Posting, currency, revaluation, tracking, and due-date flags
- Manual, coding-template, and Excel-import source provenance
- Create, edit, move, activate, deactivate, and delete workflows
- Change and deletion policies for used accounts and parent accounts
- Application-boundary permissions
- Audit events with actor and correlation context
- SQLite migration and repositories
- Persian RTL desktop UI with company selection, tree view, search, filters, and settings
- Domain, application, SQLite, and desktop tests

### Deferred

- Detailed accounts and accounting dimensions: Phase 11
- Service, trading, and manufacturing default coding templates: Phase 12
- Template versioning and atomic Excel import: Phase 12
- Journal balances and production account-usage adapter: Phase 13 and later
- Approval workflow integration for organization-specific sensitive-operation policies: future policy integration

## Architecture

The operational hierarchy contains exactly three levels:

- `group`: root account
- `general`: child of Group
- `subsidiary`: child of General

Detailed accounts are deliberately not embedded in this tree. They will be independent dimensions in Phase 11.

Account identifiers are stable and opaque. Codes remain mutable business attributes subject to company policy. Accounting behavior and reporting classification are explicit fields and are never inferred from code prefixes.

The Application Service owns authorization, hierarchy validation, transaction orchestration, optimistic concurrency, usage checks, and post-commit audit publication. Domain contracts remain independent from React, Tauri, and SQLite.

## Database

Migration:

- `0010_chart_of_accounts.sql`

Tables:

- `account_coding_settings`
- `accounts`
- `account_management_tags`

Important durable rules include:

- company-scoped account-code uniqueness
- same-company parent foreign key
- valid hierarchy parent presence
- enumerated accounting classifications and statuses
- posting allowed only for Subsidiary accounts
- revaluation allowed only with currency tracking
- non-negative display order
- optimistic-concurrency version greater than or equal to one
- management tags removed with their account

## Permissions

- `accounting.chart-of-accounts.view`
- `accounting.chart-of-accounts.create`
- `accounting.chart-of-accounts.update`
- `accounting.chart-of-accounts.move`
- `accounting.chart-of-accounts.change-status`
- `accounting.chart-of-accounts.manage-settings`
- `accounting.chart-of-accounts.delete`

`system.full-access` covers all Chart of Accounts operations. Authorization is enforced by the Application Service; UI visibility is supplementary.

## Audit Events

- `accounting.account.created`
- `accounting.account.updated`
- `accounting.account.moved`
- `accounting.account.status-changed`
- `accounting.account.deleted`
- `accounting.account-coding-settings.updated`

Events preserve company, actor, source, correlation, and causation context and are published only after a successful transaction. Deletion records the complete `before` snapshot and `after: null`.

## Change and Deletion Policies

| Operation | Policy |
|---|---|
| Delete an account with children | Forbidden |
| Delete an account with financial activity | Forbidden; deactivate instead |
| Delete an unused leaf account | Allowed with expected version |
| Change the code of a used account | Controlled by company settings |
| Deactivate a parent with active children | Forbidden |
| Update or delete using a stale version | Rejected as a concurrency conflict |

The `AccountUsageReader` contract isolates these policies from future Journal Line storage. The production journal-backed adapter will be added when journal posting exists.

## Desktop Experience

The desktop workspace provides:

- Persian RTL layout
- active-company selection
- hierarchical tree ordering
- account search and filtering
- create, edit, move, status, and delete actions
- company coding-settings management
- permission-aware actions
- actionable Persian error messages

The application UI uses the Solar Hijri and Iranian Rial conventions where dates or money are applicable; this phase itself does not introduce monetary entry or date-entry workflows.

## Validation Evidence

The following checks were executed successfully for the completed implementation:

```bash
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting build

pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri build

pnpm --filter @argin/security typecheck
pnpm --filter @argin/security build

pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop build

pnpm lint
pnpm typecheck
```

Results:

- `@argin/accounting`: 63 tests passed
- `@argin/accounting-tauri`: 8 tests passed
- `@argin/desktop`: 12 tests passed
- Accounting, SQLite adapter, Security, and Desktop builds passed
- Monorepo lint and type checking passed
- Local validation was repeated successfully after commit `eb86584`

Two pre-existing font warnings in `apps/web/src/app/layout.tsx` remain unrelated to this phase. No validation error was reported.

## Architecture Decision

- [ADR-0010 — Chart of Accounts Model](../adr/ADR-0010-chart-of-accounts-model.md)

## Known Limitations

- The current account-usage implementation is a boundary contract until Journal Lines are introduced.
- Default service, trading, and manufacturing account data is intentionally not inserted in this phase.
- Coding-template selection, version tracking, preview, and upgrade behavior belong to Phase 12.
- The desktop company selector is local to the accounting workspace until a shared current-company context is introduced.

## Exit Criteria

- Domain and application rules implemented
- SQLite migration and repositories implemented
- Permissions and audit events implemented
- Optimistic concurrency implemented
- Persian RTL desktop workspace implemented
- Domain, adapter, and UI tests passed
- Canonical documentation updated
- Remaining delivery actions: merge to `develop`, tag/release when approved

## Next Phase

Phase 11 — Accounting Dimensions.
