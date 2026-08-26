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
- Fiscal year and period must be open for Draft mutations and are revalidated immediately before final posting.
- Accounting-dimension assignments follow the Phase 11 required/optional/forbidden account policies.
- Durable dates remain canonical Gregorian; Persian UI presents Solar Hijri dates.
- Iranian Rial is the default presentation currency while currency remains explicit in the contracts.

Posted accounting facts are immutable. Approval, posting, locking, controlled amendment, reversal, and replacement follow the accepted Phase 15 lifecycle architecture in [ADR-0015](../adr/ADR-0015-journal-lifecycle.md).

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

## Journal Lifecycle Architecture

Phase 15 retains `JournalVoucher` as the authoritative owner of accounting lifecycle state and keeps the generic Phase 08 `ApprovalRequest` as a separate reusable aggregate responsible for approval state/history.

The accepted Journal lifecycle is:

```text
draft -> pending_approval -> approved -> posted -> reversed
            |                  |
            +----> draft <-----+
```

Approval rejection, return, or cancellation moves the voucher from `pending_approval` back to `draft`. Controlled amendment of an approved but unposted voucher also returns it to `draft` and invalidates the old approval for the modified content.

Approval and final posting are separate decisions. Phase 15 manual Journal posting requires current approval for the exact unmodified voucher version and then revalidates balance, account, dimension, voucher/fiscal date, and current fiscal eligibility before commit.

Ordinary content editing is permitted only in `draft`. `pending_approval`, `approved`, `posted`, and `reversed` are locked against ordinary mutation. Posted/reversed accounting lines are never edited or deleted in place.

A reversal is a separate balanced inverse Journal Voucher with explicit durable lineage to the original. The original becomes `reversed` only atomically with successful creation/commit of the reversal outcome. Duplicate retry must not create a second reversal.

All state-changing commands require optimistic expected-version checks. Retry-sensitive operations use durable request/idempotency identity. Multi-write Journal/Approval/posting/reversal operations must be atomic and success integration events are published only after commit.

## Persistence

Migration `0013_journal_vouchers.sql` adds `journal_vouchers`, `journal_lines`, and `journal_line_dimension_assignments`. SQLite repositories persist the complete voucher atomically through the Journal Unit of Work and rehydrate through Domain invariants.

Committed voucher numbers are unique per company/fiscal-year/optional-branch scope, including branchless vouchers. Non-null `(companyId, requestId)` values are unique for retry safety. Repository rehydration rejects persisted header debit/credit totals that drift from totals reconstructed from persisted lines.

Journal-backed usage readers make persisted lines and dimension assignments authoritative evidence when protecting destructive Chart of Accounts and Accounting Dimension operations.

Phase 15 will add versioned persistence for lifecycle state/evidence, current approval linkage, posting evidence, controlled-amendment evidence, and reversal/replacement lineage according to ADR-0015. Existing Phase 13 vouchers migrate deterministically as `draft`.

## Desktop Experience

The Persian RTL Journal workspace provides company-scoped list/search/detail and Draft create/edit/delete flows. Voucher dates are presented in Solar Hijri, amounts in Iranian Rial, and lines are edited in a real journal table with account, description, debit, credit, and policy-driven dynamic dimension columns.

Phase 15 lifecycle UI must present persisted status and Application-provided capabilities rather than duplicate transition rules in React. All lifecycle surfaces continue to follow the Phase 14 RTL, accessibility, keyboard, feedback, responsive, and global density contracts.

## Responsibilities

The accounting engine owns vouchers, lines, balance validation, account/fiscal/dimension eligibility orchestration, Journal lifecycle state, posting evidence, reversal lineage, Journal traceability, and the persistence-neutral boundary for lifecycle transitions.

The generic Approval subsystem owns Approval Request state and append-only approval history; Accounting references and coordinates it but does not duplicate its state machine.

The accounting engine does not own invoice calculation, inventory valuation, payroll calculation, cheque lifecycle, or tax-system transport. Those modules will produce posting requests through stable contracts in later phases.

## Foundation Timeline

Phase 09 supplies Money, Event Bus, Query Framework, Number Series, Metadata, Notification, Plugin Contracts, Shared Data Access, Optimistic Concurrency, and Background Jobs. Phase 10 supplies the Chart of Accounts. Phase 11 supplies independent accounting dimensions and reusable assignment validation. Phase 12 supplies immutable coding-template/provenance patterns. Phase 13 supplies the persisted Draft Journal Voucher Engine and journal-backed account/dimension usage detection. Phase 14 consolidates the desktop UI foundation and global density contract. Phase 15 adds the controlled Journal Lifecycle defined by ADR-0015.

## Auditability

Journal create/update/delete-draft operations preserve actor, company, branch, source, request, correlation, causation, voucher, and version context. Success integration events are emitted only after successful Journal commit; authorization denials produce security audit evidence without integration-success events.

Phase 15 lifecycle transitions additionally preserve previous/new lifecycle state, actor, timestamp, expected/current version evidence, request identity where relevant, approval linkage, posting evidence, and reversal/replacement lineage. Approval history remains normative in the Approval subsystem and is referenced rather than duplicated as a second approval-history source inside Accounting.
