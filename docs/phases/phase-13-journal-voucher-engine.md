# Phase 13 — Journal Voucher Engine

## Status

Completed, merged into `develop` and `main`, and released as `v0.13.0`. The canonical step-by-step evidence is recorded in the fixed Phase 13 implementation plan.

## Overview

Phase 13 delivers the first persisted double-entry Journal Voucher Engine in ArginAccounting. Journal vouchers are the accounting source of truth for manual draft entries and provide the stable aggregate, validation, persistence, authorization, traceability, usage detection, and Persian RTL desktop foundations required by the later Journal Lifecycle and reporting phases.

## Delivered Scope

- `JournalVoucher` aggregate with ordered `JournalLine` entities and normalized line dimension assignments
- Strict double-entry balance and mutually exclusive debit/credit line invariants
- Stable voucher/line identifiers, references, source metadata, optimistic versions, and timestamps
- Active/postable Subsidiary account eligibility and open fiscal-context validation
- Phase 11 account-dimension assignment validation reused per journal line
- Company + fiscal year + optional branch Journal Number Series integration
- Retry-safe create commands with durable request identity and idempotent replay
- Authorized create/update/delete-draft use cases and read/search/detail models
- SQLite migration `0013_journal_vouchers.sql`
- SQLite repositories, aggregate rehydration, usage readers, optimistic concurrency, and Unit of Work
- Journal-backed integrity guards for Chart of Accounts and Accounting Dimensions
- Audit/security denial evidence and post-commit integration events
- Persian RTL desktop list/detail/editor with Solar Hijri presentation and Iranian Rial amounts
- Real journal-entry table with dynamic accounting-dimension columns and responsive overflow containment
- Persistence drift detection between stored header totals and rehydrated line totals

## Domain and Application Rules

Phase 13 exposes only the `draft` lifecycle state. Posting, approval, locking, reversal, replacement, voiding, and controlled amendment remain Phase 14 responsibilities.

Every voucher must contain at least two effective lines, every line must carry a positive amount on exactly one side, line ordering must be deterministic and unique, and total debit must equal total credit. Account, fiscal, dimension, authorization, numbering, concurrency, and transaction concerns are orchestrated outside the aggregate through persistence-neutral Application contracts.

## Numbering and Retry Semantics

Journal voucher numbers use the existing Number Series infrastructure with company + fiscal year + optional branch scope and six-digit formatting. Number reservation occurs before the Journal write Unit of Work so the desktop adapter does not create nested Tauri transactions. A number consumed before a later Journal rollback remains consumed by design. A durable `(companyId, requestId)` uniqueness contract makes successful create retries return the already committed voucher without allocating a second number or publishing a duplicate success event.

## Data and Migration

Migration `apps/desktop/src-tauri/migrations/0013_journal_vouchers.sql` adds:

- `journal_vouchers`
- `journal_lines`
- `journal_line_dimension_assignments`

The schema preserves company/branch/fiscal scope, draft status, canonical Gregorian dates, explicit currency, source/request/correlation/causation metadata, header debit/credit totals, optimistic versioning, line ordering, account references, and normalized dimension references. Branchless business-number uniqueness uses an expression index that normalizes `NULL` branch scope. Child lines and assignments follow voucher deletion through controlled foreign-key cascades.

## Security and Audit

The `accounting.journal-vouchers.*` permission family contains:

- `accounting.journal-vouchers.view`
- `accounting.journal-vouchers.create`
- `accounting.journal-vouchers.update-draft`
- `accounting.journal-vouchers.delete-draft`
- `accounting.journal-vouchers.view-history`

Application services enforce authorization independently from UI gates. Successful create/update/delete events are published only after the Journal Unit of Work commits. Authorization denials create security audit evidence without publishing integration-success events.

## User Experience

The Persian RTL desktop workspace provides company-scoped search/list, voucher detail, create/edit Draft workflows, active posting-account selection, branch selection, reference and description, Solar Hijri date presentation, Rial amounts, live debit/credit totals, balance state, and line-level dynamic accounting-dimension selection.

Accounting dimensions are policy-driven rather than hard-coded. Common configured types such as Cost Center or Project therefore appear as real table columns when the selected accounts expose those dimension policies, while other configured dimension types can appear without a Journal-specific code change.

## Validation

Step 15 adds and consolidates Domain/Application coverage for malformed and unbalanced vouchers, account/fiscal eligibility, missing dimensions, authorization, idempotency/retry, cross-company access, rollback, and stale versions.

Step 16 adds and consolidates persistence/migration/Desktop regression coverage for aggregate round-trips, transaction rollback, optimistic concurrency, branchless numbering uniqueness, request-id uniqueness, cascade behavior, journal-backed usage detection, presenter/composition behavior, persisted-total drift, and the rebuilt Journal UI contract.

Step 17 completed frozen dependency installation, lint, typecheck, the full test suite, production build, documentation-index validation, and diff validation. Step 18 completed final review, merge, tag, and GitHub Release publication.

## Portability

Domain and Application contracts remain independent from React, Tauri, SQLite, PostgreSQL, .NET transport, and synchronization implementation. Stable opaque IDs, explicit scopes, canonical dates, request identity, source metadata, expected versions, and normalized relational references preserve the future Argin Bridge path to PostgreSQL/.NET API and offline synchronization.

## Related Documents

- [Phase 13 Fixed Implementation Plan](phase-13-journal-voucher-engine-plan.md)
- [ADR-0013 — Journal Voucher Engine Architecture](../adr/ADR-0013-journal-voucher-engine.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [Database Dictionary](../database/database-dictionary.md)
- [Security Model](../security/security-model.md)
- [Domain Glossary](../glossary/domain-glossary.md)

## Next Phase

Phase 14 — Journal Lifecycle.
