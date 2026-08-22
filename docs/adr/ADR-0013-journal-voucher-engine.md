# ADR-0013 — Journal Voucher Engine Architecture

- Status: Accepted
- Date: 2026-08-10
- Decision Owners: Project maintainers

## Context

Phase 13 introduces the first persisted Journal Voucher Engine in ArginAccounting. The engine must become the accounting source of truth for double-entry draft entries while preserving the boundaries established by Phase 09 platform infrastructure, Phase 10 Chart of Accounts, Phase 11 Accounting Dimensions, Phase 12 provenance/idempotency patterns, and the existing Company/Branch and Fiscal Management modules.

The desktop product remains local-first with Tauri and SQLite, while Domain/Application behavior must remain portable to the future PostgreSQL/.NET API and offline-synchronization model. Following the insertion of UI Foundation Consolidation as Phase 14, Phase 15 owns posting, approval, locking, reversal, replacement, voiding, and controlled amendment; those transitions must not leak into Phase 13.

## Decision

### Aggregate boundary

`JournalVoucher` is the aggregate root and owns its ordered `JournalLine` collection and all line-level accounting-dimension assignments. Lines are not independently mutated outside the voucher aggregate.

The aggregate carries stable opaque identity, company/optional-branch scope, system number, optional reference, canonical voucher date, explicit fiscal year/period identifiers, description, currency, source/request/correlation/causation metadata, optimistic version, timestamps, and ordered lines.

### Phase 13 lifecycle boundary

Phase 13 persists only `draft` vouchers. Posting, approval, locking, reversal, replacement, voiding, and controlled amendment remain Phase 15 responsibilities after the Phase 14 UI Foundation insertion.

### Double-entry invariants

Before persistence:

- at least two effective lines are required;
- every effective line has a positive amount on exactly one side;
- debit and credit cannot both be positive on one line;
- zero-value effective lines are rejected;
- line ordering is positive, unique, and deterministic;
- total debit equals total credit.

Amounts use the shared Money/currency contracts and Iranian Rial remains the default presentation currency.

### Account and fiscal eligibility

Application orchestration validates that every referenced account exists, belongs to the voucher company, is active, is a posting-enabled Subsidiary account, and is eligible for journal use.

The voucher date is stored as canonical Gregorian `YYYY-MM-DD`. The Application layer resolves and persists the fiscal year/period covering that date. Phase 13 mutations require an open fiscal year and period; locked/closed fiscal contexts are rejected.

### Accounting dimensions

Phase 13 reuses the Phase 11 assignment validator. Required, optional, and forbidden account-dimension policies, active type/member state, company/type compatibility, effective dates, multiplicity, duplicates, and missing references are validated per journal line.

Persisted assignments reference stable dimension type/member identifiers. Journal-backed usage readers become evidence for protecting destructive Chart of Accounts and Accounting Dimension changes.

### Numbering and idempotency

Journal numbers use the existing Number Series port with company + fiscal year + optional branch scope and six-digit presentation.

The delivered desktop adapter reserves the number **before** entering the Journal write Unit of Work. This deliberately avoids nested Tauri database transactions. If later voucher persistence rolls back, the reserved business number remains consumed. This is acceptable and preferable to unsafe number reuse.

Create commands carry a durable request identity. A committed `(companyId, requestId)` can be replayed without allocating another number or publishing another success event, and SQLite enforces uniqueness for non-null request identifiers.

### Application boundary

Application services own authorization, company/branch scope, account lookup and eligibility, fiscal resolution, dimension validation, Number Series reservation, optimistic concurrency, Unit of Work orchestration, audit/security evidence, and post-commit success-event publication.

Domain/Application public contracts remain independent from React, Tauri, SQLite, PostgreSQL, HTTP, and .NET transport.

### Persistence and atomicity

Migration `0013_journal_vouchers.sql` persists voucher headers, ordered lines, and normalized line-dimension assignments. Voucher/line/dimension writes are atomic inside the Journal Unit of Work. Updates and deletes use expected-version semantics.

SQLite uniqueness protects business numbers across company/fiscal/branch scope, including branchless vouchers through normalized `NULL` handling. Persistence rehydration rebuilds through Domain invariants and additionally rejects stored header totals that drift from totals reconstructed from persisted lines.

### Security, audit, and events

The Journal permission family covers view, create, update-draft, delete-draft, and history access. Authorization is enforced at the Application boundary.

Successful create/update/delete events are published only after the Journal Unit of Work commits. Authorization denials emit security audit evidence but never integration-success events. Idempotent replay does not duplicate the created event.

### Desktop presentation

The Desktop workspace is Persian RTL, displays Solar Hijri dates and Iranian Rial amounts, and provides list/detail/create/edit Draft flows. Journal lines use a real table with account, description, debit, credit, and dynamic Phase 11 dimension columns. Dimension labels such as Cost Center or Project appear from configured policies rather than Journal-specific hard-coding.

### Argin Bridge compatibility

- Stable opaque identifiers are used for durable entities.
- Company/branch/fiscal scope is explicit.
- Dates/timestamps remain canonical Gregorian in durable state.
- Request identity, source metadata, correlation/causation IDs, and optimistic versions preserve synchronization evidence.
- Domain/Application behavior has no SQLite-, Tauri-, React-, PostgreSQL-, or transport-specific dependency.
- The relational model can be reproduced by a future PostgreSQL adapter.

## Consequences

### Positive

- Journal vouchers are protected by Domain invariants rather than UI-only checks.
- Existing platform/account/dimension contracts are reused instead of duplicated.
- Retry behavior is deterministic and durable.
- Journal-backed usage closes the account/dimension integrity gap.
- The Desktop implementation remains compatible with the future Argin Bridge architecture.
- Phase 15 can add lifecycle transitions without redesigning the Phase 13 aggregate foundation.

### Trade-offs

- Number gaps are possible after a reservation followed by a failed voucher transaction; reuse is intentionally avoided.
- Voucher orchestration crosses Account, Fiscal, Dimension, Number Series, authorization, event, and persistence boundaries.
- Persisting fiscal IDs duplicates derivable context but preserves historical determinism.
- Normalized line dimensions increase persistence complexity in exchange for generic analytical dimensions.

## Rejected Alternatives

- Separate Journal Line aggregate: rejected because balance/order/assignments are voucher-level consistency rules.
- Both debit and credit positive on a line: rejected as semantically invalid.
- Fiscal context derived only at report time: rejected because historical context must be durable.
- SQLite AUTOINCREMENT business numbering: rejected because numbering must remain fiscal/branch scoped and portable.
- Posting/reversal in Phase 13: rejected because the later Journal Lifecycle phase owns those transitions (now Phase 15 after the Phase 14 UI insertion).
- Duplicate Journal-specific dimension rules: rejected in favor of Phase 11 contracts.
- Source modules writing Journal tables directly: rejected; future modules integrate through stable posting contracts.

## Implementation Notes

- Migration: `apps/desktop/src-tauri/migrations/0013_journal_vouchers.sql`
- Public Journal contracts: `@argin/accounting/journal`
- SQLite adapters: `@argin/accounting-tauri`
- Desktop composition: `createJournalVoucherServices`
- Persian workspace: `/accounting/journal-vouchers`
- Phase 13 remains Draft-only until Phase 15 Journal Lifecycle is explicitly implemented.

## Related Documents

- [Phase 13 — Fixed Implementation Plan](../phases/phase-13-journal-voucher-engine-plan.md)
- [Phase 13 — Implementation Record](../phases/phase-13-journal-voucher-engine.md)
- [Accounting Engine](../accounting/accounting-engine.md)
- [ADR-0010 — Chart of Accounts Model](ADR-0010-chart-of-accounts-model.md)
- [ADR-0011 — Independent Accounting Dimensions](ADR-0011-independent-accounting-dimensions.md)
- [ADR-0012 — Versioned Coding Templates](ADR-0012-versioned-coding-templates.md)
- [ADR-0014 — UI Foundation and Global Display Density](ADR-0014-ui-foundation-and-global-density.md)
- [ADR-0005 — Repository and Unit of Work](ADR-0005-repository-unit-of-work.md)
- [ADR-0009 — Platform Infrastructure First](ADR-0009-platform-infrastructure-first.md)
