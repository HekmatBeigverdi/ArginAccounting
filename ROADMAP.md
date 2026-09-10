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
   - Structured filtering, sorting, projection, and pagination
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

17. ✅ Parties
   - Natural/legal Party master model with Customer/Supplier multi-role support
   - Iranian identity, tax, contact, address, duplicate-detection, import/export, and Audit integration
   - SQLite persistence, optimistic concurrency, stable cross-store identity, tombstone/external-reference compatibility
   - Persian RTL Party workspace and reusable bounded Party Selector
   - Representative 50,000-row SQLite query-plan and full monorepo validation
18. ✅ Products and Services
   - Canonical Product/Service Master Data with durable `productId`, classification, lifecycle and capabilities
   - Product Units/conversions, SKU/reference/barcodes, official Taxpayer identifiers and versioned Taxpayer unit reference data
   - Commercial/tax/operational master attributes without prices, stock quantities, valuation or posting state
   - SQLite persistence, optimistic concurrency, idempotency, Audit/security integration and Argin Bridge-compatible tombstone/external references
   - CSV/XLSX import/export, Persian RTL desktop workspace and bounded future-module selector contracts
   - Repository/migration/Desktop regression coverage plus representative 50,000-row query-plan validation gate
   - Implementation, documentation and final merge preparation complete; semantic release `v0.18.0` prepared for manual publication
19. ✅ Warehouses
   - Canonical company-scoped Warehouse Master Data with durable `warehouseId`, classification, lifecycle and company/Branch organizational scope
   - Extensible `Warehouse -> Zone -> Location` physical hierarchy with nested Location parentage, edit/status/delete/restore/move rules and cycle prevention
   - SQLite persistence, optimistic concurrency, durable idempotency, dependency guards, tombstone-compatible deletion and Argin Bridge-ready change contracts
   - Import/export and deterministic initial Warehouse setup without stock balances or inventory transactions
   - Persian RTL dense Warehouse workspace plus bounded Company/Branch-aware reusable selectors for future ERP consumers
   - Explicit Inventory/ERP ownership boundaries: stock, movement, valuation, documents, posting, manufacturing and Taxpayer workflow remain in their owning phases
   - Domain/Application and SQLite/Migration/Desktop regression suites plus representative 50,000-Warehouse query-plan performance validation
   - Steps 1–20 complete per the canonical Phase 19 record; Tag/GitHub Release publication remains manual

## Inventory

20. ✅ Inventory Documents
   - Receipt, issue, opening, atomic transfer, quantity-adjustment and linked reversal workflows
   - Immutable exact-quantity movement ledger, rebuildable on-hand balances and deterministic quantity Kardex
   - Company/Branch/fiscal scope, numbering, Approval/Audit, idempotency, optimistic concurrency and pinned SQLite transaction boundary
   - Persian RTL document workspace, aggregate/detailed inventory views, source drill-down, Draft-only import, Excel and Print/PDF
   - Warehouse/Zone/Location dependency guards and persistence-neutral ERP/Argin Bridge contracts
   - Real SQLite migration/rollback/restart/balance-rebuild tests, performance/query-plan validation and Phase 20 quality gate
   - All 22 fixed steps completed and owner-accepted; semantic tag/GitHub Release `v0.20.0` remains manual
21. 🚧 Inventory Valuation

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

[Phase 21 — Inventory Valuation](docs/roadmap/roadmap.md). Phase 21 must consume immutable Phase 20 quantity movements without rewriting quantity history.

## Latest Completed Inventory Milestone

Phase 20 — Inventory Documents, all 22 fixed steps complete and owner-accepted. Semantic tag/GitHub Release `v0.20.0` remains a manual repository-owner action.
