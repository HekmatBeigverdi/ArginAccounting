# Phase 18 — Products and Services — Fixed Implementation Plan

## Status

Phase 18 is active. Steps 1–18 are completed; Steps 19–20 are not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

Before every step, follow:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

Detailed historical evidence through Step 14 is preserved at `docs/phases/archive/phase-18-products-services-plan-through-step-14.md`.

Later detailed evidence:

- Step 15: `docs/phases/phase-18-step-15-selector.md`
- Step 16: `docs/phases/phase-18-step-16-integration-boundaries.md`
- Step 17: `docs/phases/phase-18-step-17-domain-application-tests.md`
- Step 18: `docs/phases/phase-18-step-18-repository-desktop-tests.md`
- Status reconciliation history: `docs/phases/phase-18-status-reconciliation.md`

## Objective

Deliver canonical Product/Service Master Data and desktop workflow with persistence-neutral Domain/Application boundaries, durable identity, lifecycle, units/conversions, identifiers, commercial/tax/operational attributes, duplicate handling, SQLite persistence, authorization/audit, bulk import/export, reusable selectors, and future Argin Bridge compatibility.

Target future direction remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization remains Phase 45.

## Scope boundaries

Product/Service owns definition and reusable master data. It does not own warehouse master data, stock balances/movements, inventory valuation, purchase/sales documents, pricing/price lists, accounting postings, Taxpayer submission/signing/inquiry, manufacturing production logic, cost calculations, network synchronization, or conflict-resolution UI.

Durable `productId` is the downstream reference identity. Display code, title, SKU, barcode, and Taxpayer identifiers are not foreign identity.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | Product and Service Domain Model | Completed |
| 3 | Classification, Status, and Lifecycle | Completed |
| 4 | Units of Measure and Conversion Rules | Completed |
| 5 | Codes, Barcodes, and Official Identifiers | Completed |
| 6 | Commercial, Tax, and Operational Master Data | Completed |
| 7 | Application, Query, and Repository Contracts | Completed |
| 8 | Application Services, Validation, and Duplicate Detection | Completed |
| 9 | Migration, Schema, Constraints, and Indexing | Completed |
| 10 | Argin Bridge and Future Synchronization Contract | Completed |
| 11 | SQLite Repository, Unit of Work, and Atomic Transactions | Completed |
| 12 | Permissions, Audit, and Approval Integration | Completed |
| 13 | Bulk Import and Export | Completed |
| 14 | Persian RTL Product/Service Management UI | Completed |
| 15 | Product/Service Selector and Future Module Consumption Contract | Completed |
| 16 | Shared Platform and ERP Integration Boundaries | Completed |
| 17 | Domain and Application Tests | Completed |
| 18 | Repository, Migration, Import/Export, and Desktop Tests | Completed |
| 19 | Monorepo, Performance, Accessibility, Quality, and Documentation | Not started |
| 20 | Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

1. Baseline, Branch, and Plan Freeze
2. Product and Service Domain Model
3. Classification, Status, and Lifecycle
4. Units of Measure and Conversion Rules
5. Codes, Barcodes, and Official Identifiers
6. Commercial, Tax, and Operational Master Data
7. Application, Query, and Repository Contracts
8. Application Services, Validation, and Duplicate Detection
9. Migration, Schema, Constraints, and Indexing
10. Argin Bridge and Future Synchronization Contract
11. SQLite Repository, Unit of Work, and Atomic Transactions
12. Permissions, Audit, and Approval Integration
13. Bulk Import and Export
14. Persian RTL Product/Service Management UI
15. Product/Service Selector and Future Module Consumption Contract
16. Shared Platform and ERP Integration Boundaries
17. Domain and Application Tests
18. Repository, Migration, Import/Export, and Desktop Tests
19. Monorepo, Performance, Accessibility, Quality, and Documentation
20. Final Review, Merge, and Release

## Remaining exit criteria

### Step 19
Run focused and monorepo validation, performance/query-plan checks, accessibility/RTL/density checks, internal-link validation, and complete mandatory architecture/database/security/glossary/roadmap/changelog/release documentation.

### Step 20
Reconcile final status, run release validation, review branch scope, merge using the approved strategy, and prepare/publish semantic release `v0.18.0` as authorized.

## Change Requests

### CR-18-001 — Versioned Taxpayer Unit Reference Data — Approved

Seed official Taxpayer unit title/code reference data as versioned SQLite reference data; preserve historical codes via deactivation, keep Product `unitId`/code separate from official Taxpayer code, and allow future authorized dataset upgrades without redesigning Product Unit identity.

No other change to the frozen sequence is approved.
