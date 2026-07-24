# ADR-0009 — Shared Platform Infrastructure Before Accounting Core

- Status: Accepted
- Date: 2026-07-25

## Context

Accounting, inventory, purchases, sales, treasury, and future ERP modules need the same infrastructure capabilities. Adding them after those modules would force broad refactoring.

## Decision

Insert Phase 09 — Platform Infrastructure before Chart of Accounts. It delivers Event Bus, Money, Query Framework, Number Series, Metadata, Notification, Plugin Contracts, Shared Data Access, Optimistic Concurrency, and Background Jobs.

## Consequences

Chart of Accounts moves to Phase 10 and every later roadmap phase shifts by one. Initial platform work increases, but future modules begin on consistent contracts and avoid duplicated infrastructure.