# ArginAccounting Roadmap

This roadmap is the canonical phase-numbering source. Every phase follows the permanent [Documentation Governance](docs/development/documentation-governance.md).

## Status Legend

- ✅ Completed and merged
- 🚧 Current target
- ⏳ Planned

## Foundation

1. ✅ Repository and Architecture Baseline
2. ✅ Monorepo Bootstrap
3. ✅ Domain Foundation
4. ✅ Database Abstraction and SQLite
5. ✅ Company and Branch
6. ✅ Fiscal Year and Period
7. ✅ Security and Permissions
8. ✅ Audit Trail and Approval Workflow

## Shared Platform

9. ✅ Platform Infrastructure
   - Event Bus
   - Money
   - Query Framework
   - Number Series Engine
   - Metadata Engine
   - Notification
   - Plugin Contracts
   - Shared Data Access
   - Optimistic Concurrency
   - Background Jobs

## Accounting Core

10. ✅ Chart of Accounts
11. ✅ Accounting Dimensions
12. ✅ Coding Templates
13. ✅ Journal Voucher Engine

## Desktop Experience

14. ✅ UI Foundation Consolidation
   - Shared design system and reusable desktop primitives
   - Final application shell and navigation
   - Dashboard modernization
   - Company, branch, fiscal, security, audit, and approval UI consolidation
   - Accounting workspace visual harmonization
   - Global Compact / Comfortable / Spacious display density
   - Persian RTL, accessibility, keyboard, responsive, loading, empty, and error-state standards

## Accounting Core — Continued

15. ✅ Journal Lifecycle
16. ✅ Accounting Reports
   - Shared report query/filter/period model
   - Trial Balance, General Ledger, Subsidiary Ledger, Journal, and Accounting Dimension reports
   - Company/Branch/Fiscal/Dimension scope and report permissions
   - Persian RTL Reports Center with drill-down and Journal traceability
   - Excel, native Print/PDF, and SQLite query-plan/performance validation

## Master Data

17. 🚧 Parties
18. ⏳ Products and Services
19. ⏳ Warehouses

## Inventory

20. ⏳ Inventory Documents
21. ⏳ Inventory Valuation

## Purchases

22. ⏳ Purchase Workflow
23. ⏳ Purchase Posting

## Sales

24. ⏳ Sales Workflow
25. ⏳ Sales Posting

## Treasury

26. ⏳ Cash and Bank
27. ⏳ Cheques and Receivables
28. ⏳ Treasury Posting

## Posting Engine

29. ⏳ Posting Rules
30. ⏳ Source Document Integrity

## Iranian Taxpayer System

31. ⏳ Tax Data Model
32. ⏳ Tax Invoice Projection
33. ⏳ Validation and Signing
34. ⏳ Submission and Inquiry
35. ⏳ Retry and Error History

## Extended Enterprise Modules

36. ⏳ Fixed Assets
37. ⏳ Depreciation
38. ⏳ Payroll
39. ⏳ Human Resources
40. ⏳ Manufacturing
41. ⏳ Cost Accounting
42. ⏳ Budgeting
43. ⏳ Contracts and Projects
44. ⏳ Advanced Reporting
45. ⏳ Synchronization
46. ⏳ Backup and Restore
47. ⏳ Deployment and Production Hardening

## Phase 09 Rationale

Platform Infrastructure is intentionally placed before the Accounting Core. Building these shared capabilities after Accounting, Sales, Inventory, and Treasury would require broad refactoring and duplicated contracts. See [ADR-0009](docs/adr/ADR-0009-platform-infrastructure-first.md).

## Phase 14 Rationale

UI Foundation Consolidation is intentionally placed after the first complete accounting workspace and before Journal Lifecycle. Phases 05–08 still contained temporary or first-generation desktop surfaces, while Phases 10–13 established a more mature workspace-oriented Persian RTL interface. Consolidating the shell, design system, shared primitives, earlier workspaces, and global density contract prevents duplicated UI patterns and broad visual refactoring across later accounting and ERP phases.

Phase 14 is a presentation and desktop-experience phase. It does not introduce Phase 15 Journal Lifecycle business behavior or move domain/application rules into UI components.

## Delivery Rules

A phase is complete only when:

1. Domain and application rules are outside UI components.
2. Database changes use versioned migrations.
3. Permissions are enforced at the application boundary.
4. Multi-write operations are atomic.
5. Required checks are actually executed and their results recorded.
6. Canonical documents, phase guide, glossary, ADRs, and changelog are updated.
7. Internal links are verified.
8. The phase branch is merged according to the branch strategy.
9. A semantic release is created when appropriate.
10. User-facing desktop surfaces delivered or touched by the phase follow the shared Persian RTL design system and define loading, empty, error, focus, and responsive behavior where applicable.

## Current Target

Phase 17 — Parties.

## Latest Completed Accounting Milestone

Phase 16 — Accounting Reports, implementation/final review completed and prepared for semantic release `v0.16.0`.
