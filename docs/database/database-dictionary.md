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
| Journal Voucher Engine | `journal_vouchers`, `journal_lines`, `journal_line_dimension_assignments` | Phase 13 |
| Parties | `parties`, `party_roles`, `party_contacts`, `party_addresses`, `party_external_references` | Phase 17 |

## Phase 10 — Chart of Accounts

### `account_coding_settings`

One versioned settings row per company. Stores Group, General, and Subsidiary code lengths, hierarchical-code enforcement, and whether codes may change after financial use. The company foreign key uses `ON DELETE RESTRICT`.

### `accounts`

Company-scoped operational account hierarchy with stable text identifiers, same-company parent enforcement, unique `(company_id, code)`, accounting classifications, behavior flags, status, source provenance, timestamps, and optimistic-concurrency `version`.

### `account_management_tags`

Ordered management-report tags keyed by account and case-insensitive tag value. The account foreign key uses `ON DELETE CASCADE`.

### Migration

- `apps/desktop/src-tauri/migrations/0010_chart_of_accounts.sql`

## Phase 11 — Accounting Dimensions

### `accounting_dimension_types`

Company-scoped analytical-axis definitions with unique case-insensitive code, names, hierarchy and multiple-member flags, lifecycle status, display order, source provenance, timestamps, and optimistic-concurrency version.

### `accounting_dimension_members`

Members scoped to a company and dimension type. Codes are unique within that scope. Optional parents must belong to the same company and type. Effective dates are nullable canonical Gregorian values.

### `account_dimension_policies`

Versioned relationship between a company-scoped account and dimension type. One row per account/type pair declares `required`, `optional`, or `forbidden`.

### Migration

- `apps/desktop/src-tauri/migrations/0011_accounting_dimensions.sql`

## Phase 12 — Coding Templates

Migration `0012_coding_templates.sql` adds the explicit company `activity_type` compatibility value and persists template lifecycle, immutable versions, normalized account/dimension/member/policy items, application history and operational mappings, and Excel import-batch provenance. Constraints preserve template/version identity, item references, company scope, request-key idempotency, fingerprints, and optimistic concurrency.

### Migration

- `apps/desktop/src-tauri/migrations/0012_coding_templates.sql`

## Phase 13 — Journal Voucher Engine

### `journal_vouchers`

Company-scoped Journal Voucher header with stable text identity, optional branch scope, business voucher number, optional external reference, canonical Gregorian voucher date, explicit fiscal year/period references, Draft-only status, currency code, source metadata, request/correlation/causation identifiers, stored debit/credit totals, creation/update timestamps, and optimistic-concurrency `version`.

Important integrity rules:

- `total_debit = total_credit` at durable header level;
- committed voucher number is unique per company + fiscal year + branch scope;
- branchless uniqueness is protected with an expression index that normalizes `NULL` branch scope;
- non-null `(company_id, request_id)` is unique for durable create idempotency;
- fiscal/company/branch references are explicit and relational;
- indexes support company/date, branch/date, fiscal, reference, source, request, correlation, and causation queries.

### `journal_lines`

Ordered child rows of one Journal Voucher. Each line stores company scope, account reference, description, debit amount, credit amount, and currency context.

Important integrity rules:

- line order is positive and unique inside its voucher;
- exactly one of debit/credit must be positive;
- line account references are company-consistent;
- voucher deletion cascades to lines;
- indexes support account-usage and voucher retrieval queries.

Cross-row minimum-line and exact line-sum-to-header rules remain Domain/Application responsibilities because SQLite row constraints cannot safely express them. Repository rehydration independently rejects persisted header totals that disagree with totals reconstructed through Domain invariants.

### `journal_line_dimension_assignments`

Normalized many-to-many references from a journal line to Phase 11 dimension type/member identities. Rows preserve voucher, line, company, dimension type, and member references and support journal-backed dimension usage checks.

Voucher/line deletion cascades to assignments. Company/type/member consistency is protected by the schema and Application dimension validator.

### Migration

- `apps/desktop/src-tauri/migrations/0013_journal_vouchers.sql`

## Phase 17 — Parties

### `parties`

Company-scoped Party aggregate root. The TEXT `id` is durable identity and is distinct from the human-readable `code`. Stores natural/legal classification, active/inactive status, normalized names, Iranian identity/registration/tax fields, Gregorian timestamps, optimistic `version`, and nullable `deleted_at` synchronization tombstone metadata.

Important integrity rules:

- `(company_id, code)` is unique;
- official national code, legal national identifier, and economic number are unique within company when present;
- classification-specific name/identity shapes are constrained;
- `version >= 1`;
- `deleted_at` is synchronization deletion metadata and does not replace active/inactive business status.

### `party_roles`

Normalized commercial roles for one Party. Current values are `customer` and `supplier`; one Party can contain both. Same-company composite foreign keys prevent cross-company child ownership. Party deletion cascades to roles.

### `party_contacts`

Normalized phone/mobile/email/website child rows with purpose, primary flag, and optional contact-person metadata. Primary uniqueness follows Party Domain rules for type + purpose. Party deletion cascades to contacts.

### `party_addresses`

Normalized Iranian address child rows with purpose, country, province/city/district, address line, postal code, and primary flag. Primary uniqueness follows address purpose. Party deletion cascades to addresses.

### `party_external_references`

Source-system identity mappings for future Bridge/import traceability. Values are company-scoped and link source-system/external IDs to the durable Party identity. They must not be confused with Party display code.

### Query/index policy

Indexes support company/status/name paging, classification/name search, update-order scans, role selectors, contact/address lookups, hard duplicate checks, incremental sync changes, tombstones, and external-reference lookup. Phase 17 validation requires bounded list/select/export behavior and representative SQLite query-plan use of the accepted indexes.

### Migrations

- `apps/desktop/src-tauri/migrations/0016_parties.sql`
- `apps/desktop/src-tauri/migrations/0017_party_sync_metadata.sql`
