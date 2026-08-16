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
13. 🚧 Journal Voucher Engine
14. ⏳ Journal Lifecycle
15. ⏳ Accounting Reports

## Master Data

16. ⏳ Parties
17. ⏳ Products and Services
18. ⏳ Warehouses

## Inventory

19. ⏳ Inventory Documents
20. ⏳ Inventory Valuation

## Purchases

21. ⏳ Purchase Workflow
22. ⏳ Purchase Posting

## Sales

23. ⏳ Sales Workflow
24. ⏳ Sales Posting

## Treasury

25. ⏳ Cash and Bank
26. ⏳ Cheques and Receivables
27. ⏳ Treasury Posting

## Posting Engine

28. ⏳ Posting Rules
29. ⏳ Source Document Integrity

## Iranian Taxpayer System

30. ⏳ Tax Data Model
31. ⏳ Tax Invoice Projection
32. ⏳ Validation and Signing
33. ⏳ Submission and Inquiry
34. ⏳ Retry and Error History

## Extended Enterprise Modules

35. ⏳ Fixed Assets
36. ⏳ Depreciation
37. ⏳ Payroll
38. ⏳ Human Resources
39. ⏳ Manufacturing
40. ⏳ Cost Accounting
41. ⏳ Budgeting
42. ⏳ Contracts and Projects
43. ⏳ Advanced Reporting
44. ⏳ Synchronization
45. ⏳ Backup and Restore
46. ⏳ Deployment and Production Hardening

## Phase 09 Rationale

Platform Infrastructure is intentionally placed before the Accounting Core. Building these shared capabilities after Accounting, Sales, Inventory, and Treasury would require broad refactoring and duplicated contracts. See [ADR-0009](docs/adr/ADR-0009-platform-infrastructure-first.md).

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

## Current Target

Phase 13 — Journal Voucher Engine closure: documentation, final validation, review, merge, and release.

## Next Accounting Milestone

Phase 14 — Journal Lifecycle. It starts only after Phase 13 Step 18 is explicitly approved, merged, and released.
