# Accounting Engine

## Purpose

The accounting engine is the authoritative domain for double-entry accounting. It remains independent from UI, SQLite, Tauri, tax submission, and source-document modules.

## Core Invariants

- Every journal voucher balances: total debit equals total credit.
- A voucher contains at least two effective journal lines.
- Amounts are non-negative; direction is represented by debit or credit.
- A line cannot carry both debit and credit and cannot be an effective zero-value line.
- Line order is deterministic and unique inside the voucher.
- Accounts must be active, posting-enabled Subsidiary accounts in the same company scope.
- Fiscal year and period must be open for Phase 13 draft mutations.
- Accounting-dimension assignments follow the Phase 11 required/optional/forbidden account policies.
- Durable dates remain canonical Gregorian; Persian UI presents Solar Hijri dates.
- Iranian Rial is the default presentation currency while currency remains explicit in the contracts.

Posted-voucher immutability, posting approval, reversal, replacement, locking, and controlled amendment belong to Phase 15 and are not active Phase 13 behavior.

## Implemented Journal Voucher Engine

Phase 13 delivers `JournalVoucher` as the aggregate root owning ordered `JournalLine` entities and normalized line dimension assignments. The aggregate enforces structural and balance invariants before persistence.

Application orchestration provides:

- authorization and company/branch scope;
- account eligibility and fiscal-context resolution;
- Phase 11 dimension validation;
- company + fiscal year + optional branch Number Series reservation;
- request-id idempotency and retry replay;
- optimistic concurrency;
- Journal Unit of Work behavior;
- audit/security evidence and post-commit success events;
- persistence-neutral read/search/detail contracts.

The delivered Desktop Number Series adapter reserves a business number before the Journal write Unit of Work so nested Tauri transactions are avoided. A reservation followed by a failed voucher write may leave an intentional number gap; committed request-id replay never creates a second voucher or duplicate success event.

## Persistence

Migration `0013_journal_vouchers.sql` adds `journal_vouchers`, `journal_lines`, and `journal_line_dimension_assignments`. SQLite repositories persist the complete voucher atomically through the Journal Unit of Work and rehydrate through Domain invariants.

Committed voucher numbers are unique per company/fiscal-year/optional-branch scope, including branchless vouchers. Non-null `(companyId, requestId)` values are unique for retry safety. Repository rehydration rejects persisted header debit/credit totals that drift from totals reconstructed from persisted lines.

Journal-backed usage readers make persisted lines and dimension assignments authoritative evidence when protecting destructive Chart of Accounts and Accounting Dimension operations.

## Desktop Experience

The Persian RTL Journal workspace provides company-scoped list/search/detail and Draft create/edit/delete flows. Voucher dates are presented in Solar Hijri, amounts in Iranian Rial, and lines are edited in a real journal table with account, description, debit, credit, and policy-driven dynamic dimension columns.

## Responsibilities

The accounting engine owns vouchers, lines, balance validation, account/fiscal/dimension eligibility orchestration, journal traceability, and the persistence-neutral boundary for later lifecycle transitions.

It does not own invoice calculation, inventory valuation, payroll calculation, cheque lifecycle, or tax-system transport. Those modules will produce posting requests through stable contracts in later phases.

## Foundation Timeline

Phase 09 supplies Money, Event Bus, Query Framework, Number Series, Metadata, Notification, Plugin Contracts, Shared Data Access, Optimistic Concurrency, and Background Jobs. Phase 10 supplies the Chart of Accounts. Phase 11 supplies independent accounting dimensions and reusable assignment validation. Phase 12 supplies immutable coding-template/provenance patterns. Phase 13 supplies the persisted Draft Journal Voucher Engine and journal-backed account/dimension usage detection. Phase 14 consolidates the desktop UI foundation and global density contract. Phase 15 adds the controlled Journal Lifecycle.

## Auditability

Journal create/update/delete-draft operations preserve actor, company, branch, source, request, correlation, causation, voucher, and version context. Success integration events are emitted only after successful Journal commit; authorization denials produce security audit evidence without integration-success events.
