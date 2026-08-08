# Database Dictionary

This dictionary is the canonical catalog of database objects. It complements migration files and must describe the current schema without replacing the migrations.

## Table Entry Format

For every table record:

- table name and owning module;
- business purpose;
- primary key strategy;
- company, branch, and fiscal scopes;
- important columns and data types;
- foreign keys and delete behavior;
- unique constraints and indexes;
- audit and concurrency columns;
- creating and modifying migrations;
- retention, archival, and sensitivity classification.

## Current High-Level Catalog

| Area | Tables | Introduced |
|---|---|---|
| Company and Branch | Company and branch persistence objects | Phase 05 |
| Fiscal Management | Fiscal years and periods | Phase 06 |
| Security | Users, roles, permissions, assignments, branch access | Phase 07 |
| Audit and Approval | `audit_entries`, `approval_requests`, `approval_history` | Phase 08 |
| Platform Infrastructure | `background_jobs`, `notifications` | Phase 09 |
| Chart of Accounts | `account_coding_settings`, `accounts`, `account_management_tags` | Phase 10 |
| Accounting Dimensions | `accounting_dimension_types`, `accounting_dimension_members`, `account_dimension_policies` | Phase 11 |
| Coding Templates | `coding_templates`, normalized version-item tables, application mappings/history, import batches | Phase 12 |

## Phase 10 — Chart of Accounts

### `account_coding_settings`

One versioned settings row per company. Stores Group, General, and Subsidiary code lengths, hierarchical-code enforcement, and whether codes may change after financial use. The company foreign key uses `ON DELETE RESTRICT`.

### `accounts`

Company-scoped operational account hierarchy with stable text identifiers, same-company parent enforcement, unique `(company_id, code)`, accounting classifications, behavior flags, status, source provenance, timestamps, and optimistic-concurrency `version`.

Groups have no parent, General accounts belong to Groups, and Subsidiary accounts belong to General accounts. SQLite constraints reject invalid enumerations, posting on non-Subsidiary levels, revaluation without currency support, negative display order, and conflicting financial flags.

### `account_management_tags`

Ordered management-report tags keyed by account and case-insensitive tag value. The account foreign key uses `ON DELETE CASCADE`.

### Migration

- `apps/desktop/src-tauri/migrations/0010_chart_of_accounts.sql`

The detailed column-level catalog must be expanded whenever a migration adds or changes a database object.

## Phase 11 — Accounting Dimensions

### `accounting_dimension_types`

Company-scoped analytical-axis definitions with unique case-insensitive code, names, hierarchy and multiple-member flags, lifecycle status, display order, source provenance, timestamps, and optimistic-concurrency version. Company deletion is restricted.

### `accounting_dimension_members`

Members scoped to a company and dimension type. Codes are unique within that scope. Optional parents must belong to the same company and type; self-parenting is rejected. Effective dates are nullable Gregorian `YYYY-MM-DD` values with ordered range validation. Type, parent, and company deletion is restricted.

### `account_dimension_policies`

Versioned relationship between a company-scoped account and dimension type. One row per account/type pair declares `required`, `optional`, or `forbidden`. Account and dimension-type deletion is restricted.

### Migration

- `apps/desktop/src-tauri/migrations/0011_accounting_dimensions.sql`

## Phase 12 — Coding Templates

Migration `0012_coding_templates.sql` adds the explicit company `activity_type` compatibility value and persists template lifecycle, immutable versions, normalized account/dimension/member/policy items, application history and operational mappings, and Excel import-batch provenance. Constraints preserve template/version identity, item references, company scope, request-key idempotency, fingerprints, and optimistic concurrency. Indexes support catalog paging, version lookup, application history, synchronization evidence, and retry recovery.

### Migration

- `apps/desktop/src-tauri/migrations/0012_coding_templates.sql`
