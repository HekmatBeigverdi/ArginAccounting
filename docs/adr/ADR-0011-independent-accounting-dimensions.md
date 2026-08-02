# ADR-0011 — Independent Accounting Dimensions

- Status: Accepted
- Date: 2026-08-02
- Decision Owners: Project maintainers

## Context

The Chart of Accounts introduced a stable three-level operational hierarchy: Group, General, and Subsidiary. Iranian accounting workflows also require reusable detailed classifications such as parties, projects, cost centres, contracts, and other analytical axes. Modeling those values as a fourth account level would duplicate master data, couple account maintenance to analytical reporting, and make multi-dimensional journal lines difficult to validate.

## Decision

Accounting dimensions are independent, company-scoped aggregates rather than account-tree nodes.

- A dimension type defines an analytical axis and whether it is hierarchical or allows multiple selected members.
- A dimension member belongs to exactly one dimension type and may have an effective date range. Parent members are permitted only for hierarchical types and must belong to the same company and type.
- An account-dimension policy relates an active account to a dimension type with one requirement: `required`, `optional`, or `forbidden`.
- A journal-line assignment references a dimension type and one or more member identifiers. Validation resolves account policies, active status, company and type scope, effective dates, and the multiple-member rule.
- Aggregate identifiers are stable. Codes are normalized mutable business attributes, unique within their defined company scope.
- Repositories and application contracts remain independent from SQLite, Tauri, and React. SQLite is an adapter behind those contracts.
- All mutations use optimistic concurrency, application-boundary permissions, transactions, and post-commit audit events.

## Consequences

### Positive

- The three-level Chart of Accounts remains stable.
- Analytical axes can be reused across accounts and future source modules.
- One accounting line can carry multiple independent classifications.
- Posting validation can be deterministic and account-specific.
- Future master-data adapters can expose parties, projects, cost centres, or contracts without restructuring `accounts`.

### Negative

- Posting must resolve policies and members in addition to the account.
- Deletion and status changes require usage checks across future journal and source-document storage.
- Master-data-backed dimensions require integration adapters in later phases.

### Risks

- A module could bypass the assignment-validation contract and persist inconsistent classifications.
- Large member sets require indexed, paged selector queries.
- Policy changes after posting require historical assignments and audit evidence to remain interpretable.

## Alternatives Considered

- Add Detailed Account as a fourth account-tree level: rejected because it couples analytical identity to account structure and prevents independent multi-axis analysis.
- Store arbitrary key/value metadata on journal lines: rejected because it lacks referential integrity, lifecycle rules, permissions, and deterministic validation.
- Create a separate account tree for every analytical axis: rejected because it duplicates data and increases maintenance and reconciliation risk.

## Implementation Notes

- Migration: `apps/desktop/src-tauri/migrations/0011_accounting_dimensions.sql`
- Tables: `accounting_dimension_types`, `accounting_dimension_members`, `account_dimension_policies`
- Domain and application package: `@argin/accounting`
- SQLite adapter: `@argin/accounting-tauri`
- Desktop route: `/accounting/dimensions`
- A production journal-backed usage reader and persisted journal-line assignments are deferred until the Journal Voucher Engine.

## Related Documents

- [Phase 11 — Accounting Dimensions](../phases/phase-11-accounting-dimensions.md)
- [ADR-0010 — Chart of Accounts Model](ADR-0010-chart-of-accounts-model.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [Database Dictionary](../database/database-dictionary.md)
