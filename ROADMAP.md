# ArginAccounting Roadmap

This roadmap defines the planned delivery sequence for ArginAccounting. Each phase is developed on a dedicated `phase/*` branch, validated, documented, and merged into `develop` before the next phase begins.

## Status Legend

- ✅ Completed
- 🚧 In progress
- ⏳ Planned

## Foundation

1. ✅ Repository and Architecture Baseline
2. ✅ Monorepo Bootstrap
3. ✅ Domain Foundation
4. ✅ Database Abstraction and SQLite
5. ✅ Company and Branch
6. ✅ Fiscal Year and Period
7. ✅ Security and Permissions
8. 🚧 Audit Trail and Approval Workflow

## Accounting Core

9. ⏳ Chart of Accounts
10. ⏳ Accounting Dimensions
11. ⏳ Coding Templates
12. ⏳ Journal Voucher Engine
13. ⏳ Journal Lifecycle
14. ⏳ Accounting Reports

## Master Data

15. ⏳ Parties
16. ⏳ Products and Services
17. ⏳ Warehouses

## Inventory

18. ⏳ Inventory Documents
19. ⏳ Inventory Valuation

## Purchases

20. ⏳ Purchase Workflow
21. ⏳ Purchase Posting

## Sales

22. ⏳ Sales Workflow
23. ⏳ Sales Posting

## Treasury

24. ⏳ Cash and Bank
25. ⏳ Cheques and Receivables
26. ⏳ Treasury Posting

## Posting Engine

27. ⏳ Posting Rules
28. ⏳ Source Document Integrity

## Iranian Taxpayer System

29. ⏳ Tax Data Model
30. ⏳ Tax Invoice Projection
31. ⏳ Validation and Signing
32. ⏳ Submission and Inquiry
33. ⏳ Retry and Error History

## Extended Enterprise Modules

34. ⏳ Fixed Assets
35. ⏳ Depreciation
36. ⏳ Payroll
37. ⏳ Human Resources
38. ⏳ Manufacturing
39. ⏳ Cost Accounting
40. ⏳ Budgeting
41. ⏳ Contracts and Projects
42. ⏳ Advanced Reporting
43. ⏳ Synchronization
44. ⏳ Backup and Restore
45. ⏳ Deployment and Production Hardening

## Phase 08 Scope

Phase 08 delivers:

- Immutable audit entries with before and after snapshots
- Sensitive-value sanitization
- Audit actor, source, target, scope, outcome, and correlation identifiers
- Configurable approval requests and state transitions
- Approval history and decision metadata
- Permission-protected application services
- Atomic Approval + History + Audit persistence
- Optimistic concurrency through record versions
- SQLite repositories and transaction orchestration
- Desktop composition root and authenticated permission injection
- Persian Approval and Audit Viewer pages
- Application and Unit of Work tests

## Delivery Rules

A phase is complete only when:

1. Domain and application rules are implemented outside UI components.
2. Database changes use versioned migrations.
3. Permission checks exist at the application boundary.
4. Critical multi-write operations are atomic.
5. Type checking, tests, desktop build, and Rust checks pass.
6. Documentation and changelog are updated.
7. The phase branch is merged into `develop` with a non-fast-forward merge.
8. A semantic version tag and release are created when appropriate.

## Next Phase

Phase 09 introduces the Chart of Accounts domain, hierarchical coding rules, account nature, posting eligibility, configurable code lengths, and Persian desktop management screens.