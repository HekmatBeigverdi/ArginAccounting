# Accounting Engine

## Purpose

The accounting engine is the authoritative domain for double-entry accounting. It must remain independent from UI, SQLite, Tauri, tax submission, and source-document modules.

## Core Invariants

- Every journal voucher balances: total debit equals total credit.
- Amounts are non-negative; direction is represented by debit or credit.
- A line cannot carry both debit and credit.
- Accounts must be active, postable, in scope, and valid for the voucher date.
- Fiscal year and period must be open for the requested operation.
- Posted vouchers are immutable.
- Corrections are represented by reversal, replacement, or controlled amendment workflows.
- Currency, exchange rate, dimensions, branch, project, and cost-centre requirements are validated from account and posting policy.

## Responsibilities

The engine owns vouchers, lines, balance validation, lifecycle transitions, posting eligibility, reversal semantics, references to source documents, and accounting traceability.

It does not own invoice calculation, inventory valuation, payroll calculation, cheque lifecycle, or tax-system transport. Those modules produce posting requests through stable contracts.

## Implemented Foundations

Phase 09 supplies shared Money, Event Bus, Query Framework, Number Series, Metadata, Notification, Plugin Contracts, Shared Data Access, Optimistic Concurrency, and Background Jobs. Phase 10 supplies the three-level Chart of Accounts. Phase 11 supplies independent dimension types, members, account requirement policies, assignment validation, and dynamic selector contracts. Phase 12 composes those foundations through immutable coding-template versions, deterministic preview, atomic retry-safe application, non-destructive upgrades, and validated Excel import. Persisted vouchers, lines, and journal-backed usage detection begin in Phase 13.

## Auditability

Every lifecycle transition and posting outcome must create audit evidence with actor, timestamp, source, correlation ID, and relevant before/after state.
