# ADR-0010 — Chart of Accounts Model

- Status: Accepted
- Date: 2026-07-29

## Context

ArginAccounting needs a company-scoped chart of accounts that supports Iranian corporate accounting while remaining independent from any single predefined coding scheme. The operational hierarchy must model Group, General, and Subsidiary accounts, preserve stable account identities when codes change, and support Persian names with normalized numeric codes.

The design must also prepare the accounting core for two later phases:

- Phase 11 will introduce accounting dimensions and detailed accounts as independent entities.
- Phase 12 will introduce versioned coding templates for service, trading, and manufacturing companies, plus validated Excel import.

Inferring accounting behavior or report classification from code prefixes would couple the domain to a particular template and make later customization unsafe.

## Decision

### Operational hierarchy

The operational chart of accounts contains exactly three levels:

- `group`: a root account with no parent.
- `general`: a child of a Group account.
- `subsidiary`: a child of a General account.

Detailed accounts are not stored in the accounts hierarchy. They will be modeled as independent accounting dimensions in Phase 11.

Every account belongs to one company. A parent and child must belong to the same company. Cycles and invalid parent-child combinations are forbidden.

### Stable identity and mutable codes

Each account has a stable, opaque `id`. The account code is a mutable business attribute, so changing a code never changes the account identity or existing references.

Codes are unique within a company, not globally. Persian and Arabic digits are normalized to English digits before validation and persistence.

### Company-specific coding settings

Code lengths and hierarchical-code enforcement are company settings rather than hard-coded domain rules. The default lengths are:

- Group: 2
- General: 4
- Subsidiary: 6

The model supports changing these defaults under an explicit permission and policy. Accounting meaning, account nature, posting behavior, and report classification are never inferred from code prefixes.

### Posting behavior

Group and General accounts cannot accept journal postings. A Subsidiary account may be posting-enabled or control-only.

Revaluation is allowed only when currency tracking is enabled. Other account features, including tracking and due-date behavior, are explicit attributes.

### Reporting classification

Financial-statement and management-report classifications are stored explicitly and separately from account codes. The classification model may include balance-sheet section, income-statement section, cash-flow category, cash-equivalent, receivable, payable, and management tags.

### Source provenance

Every account records how it was created:

- `manual`
- `coding_template`
- `excel_import`

Template- and import-created accounts may also retain a source reference. This provenance prepares the model for versioned service, trading, and manufacturing templates and atomic Excel import in Phase 12.

### Change control

Renaming an account preserves its identity and is audited.

Changing an account code, moving it, deactivating a used account or subtree, changing the nature of a used account, disabling posting on a used account, and deleting an account are sensitive operations. They require dedicated permissions, audit records, and where policy requires, approval.

Physical deletion is allowed only for an unused leaf account with no operational, opening-balance, posting-rule, or mapping references. Otherwise the account is deactivated.

Sensitive events use the Event Bus and correlation/causation context introduced in Phase 09.

### Concurrency and persistence

Mutable records use optimistic concurrency through a monotonically increasing `version`. Multi-record operations, including subtree changes and future template or Excel imports, execute transactionally.

SQLite enforces durable invariants such as foreign keys, company-scoped code uniqueness, enumerated values, and the dependency between revaluation and currency support. Hierarchy rules that require loading related accounts remain in the Domain and Application layers.

## Consequences

### Positive

- Each company can maintain an independent and customizable chart of accounts.
- Stable identifiers protect journal and integration references when codes change.
- The model supports Iranian Group–General–Subsidiary coding without embedding a specific template.
- Phase 11 can add detailed dimensions without restructuring the accounts table.
- Phase 12 can add versioned service, trading, and manufacturing templates and atomic Excel import without redesigning the account aggregate.
- Explicit classifications make reports resilient to code changes.
- Permission, audit, approval, and optimistic concurrency controls protect sensitive accounting changes.

### Trade-offs

- Account validation requires company coding settings and, for hierarchy changes, parent or descendant data.
- Explicit report classifications require more data than prefix-based inference.
- Moving, deleting, or changing used accounts requires policy and usage checks across accounting and integration modules.
- Template application and Excel import must preserve provenance and execute as transactional application workflows.

## Follow-up

- Phase 10 implements the account aggregate, coding settings, report classification, SQLite schema, repository, use cases, permissions, audit events, tests, and a minimal Persian RTL UI.
- Phase 11 implements accounting dimensions and their allowed relationships to accounts.
- Phase 12 implements versioned coding templates for service, trading, and manufacturing companies, administrator template management, preview, conflict validation, and atomic Excel import.
