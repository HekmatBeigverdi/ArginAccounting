# Phase 18 — Products and Services — Fixed Implementation Plan

## Status

Phase 18 implementation is complete. Steps 1–20 are completed. Promotion to `develop` and `main` is part of Step 20 and is recorded below. Final semantic tag and GitHub Release `v0.18.0` are intentionally left to the repository owner for manual publication.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

This file is the canonical Phase 18 record. Step status, implementation evidence, validation evidence, Change Requests, and phase exit criteria are maintained here. Cross-cutting rules remain in their canonical architecture/database/security/glossary documents.

Mandatory governance:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

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
| 19 | Monorepo, Performance, Accessibility, Quality, and Documentation | Completed |
| 20 | Final Review, Merge, and Release | Completed |

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

## Consolidated implementation evidence

### Steps 1–14

- Established independent `@argin/product` Domain/Application and dedicated `@argin/product-tauri` SQLite adapter packages.
- Added stable company-scoped `productId`, Product/Service classification, active/inactive lifecycle, category and purchasable/sellable capabilities.
- Added deterministic Product Unit profiles with base/alternate units, ratios, precision, rounding and official Taxpayer unit mappings.
- Added SKU/reference/barcodes/external identifiers and 13-digit Taxpayer goods/service identifiers with normalized hard-duplicate boundaries.
- Added commercial, tax and operational master attributes while explicitly excluding price, stock quantity, valuation and posting state.
- Added persistence-neutral commands/queries/readers/repositories/UoW/errors, duplicate detection, idempotency, optimistic concurrency and reference validation.
- Added migrations `0018`–`0021` for Taxpayer unit reference data, Product persistence, synchronization metadata and Product idempotency.
- Added security permissions, secured Application boundaries and shared Audit composition without inventing a Product-specific Approval workflow.
- Added CSV/XLSX preview/import/export with Domain validation, strong/advisory duplicate diagnostics, atomic mode and bounded export.
- Added Persian RTL Product/Service Desktop management with Phase 14 density, field-level validation, click-only viewport-aware help, searchable Taxpayer unit selection, keyboard handling and responsive states.
- UI corrections discovered during acceptance, including Audit transaction composition and stale optimistic-version behavior, were addressed on the phase branch.

### Step 15 — Product/Service Selector and Future Module Consumption Contract

- Added persistence-neutral `ProductSelectorService` and secured selector boundary with bounded requests (`1..100`, default `20`).
- Added reusable usages for general, inventory, purchase, sales, taxpayer, manufacturing and cost-accounting consumers.
- Mandatory consumer eligibility cannot be relaxed by caller filters; incompatible intersections return no results rather than broadening the query.
- Selector results preserve durable `productId`/`durableId` while code/title remain display metadata.
- Added `requiresTaxpayerGoodsServiceId` and `SqliteProductSelectorReader`; filters are applied in SQL before `LIMIT`, tombstones are excluded, and queries remain company-scoped.
- Added focused selector tests and `docs/architecture/product-selector-contract.md`.

### Step 16 — Shared Platform and ERP Integration Boundaries

- Reused existing Company scope, Security, Audit, shared database/UoW, optimistic concurrency, bounded query and Gregorian metadata capabilities instead of duplicating them.
- Product is company-scoped Master Data; Branch does not duplicate Product identity.
- Defined forward-only downstream ownership: Warehouse owns warehouse definitions; Inventory owns quantities/movements; valuation owns cost layers; Purchases/Sales own transactional prices/documents; Accounting owns posting; Taxpayer phases own projection/signing/submission/inquiry; Manufacturing and Cost Accounting own their respective workflows.
- Party and Product remain peer Master Data contexts consumed together by future documents without reverse dependency.
- Price/list-price behavior remains explicitly outside Product Master Data.
- Added `docs/architecture/product-shared-platform-integration.md` and architecture regression coverage.

### Step 17 — Domain and Application Tests

- Consolidated Product Domain/Application coverage for classification/lifecycle, UoM/conversions, identifiers, master attributes, duplicate semantics, idempotency, optimistic concurrency, company isolation, security, selector and sync contracts.
- Added regression coverage for company-isolated mutation behavior, idempotency scoping, expected-version chains across multiple mutations, invalid context rejection before UoW entry, and default-unit reference safety.
- Core business behavior remains independently testable without SQLite/Desktop.

### Step 18 — Repository, Migration, Import/Export, and Desktop Tests

- Added real `node:sqlite` in-memory migration/constraint coverage for migrations 18–21, company scope, strong identifier uniqueness, Taxpayer-unit references, tombstones, idempotency constraints and transaction rollback.
- Added Product Tauri persistence regression tests for idempotency cleanup/concurrency and bounded selector behavior.
- Retained CSV/XLSX import/export round-trip, limits, atomic import and duplicate coverage.
- Added Desktop contracts for Product route/permission, bounded loading, loading/empty/error states, field-level validation, click-only viewport-aware help, reference-data unit selection and absence of direct Product SQL in React.

### Step 19 — Monorepo, Performance, Accessibility, Quality, and Documentation

- Added `@argin/product-tauri validate:performance` using a representative 50,000-row Product/Service dataset and SQLite `EXPLAIN QUERY PLAN` checks for list, Inventory-style selector and SKU hard-duplicate paths. Portable quality criteria are expected index use and bounded queries, not hardware-specific elapsed-time thresholds.
- Added root `pnpm validate:phase18` as the unified Phase 18 gate: Product/Product-Tauri tests and typecheck, Product performance validation, Security/Audit checks, Desktop typecheck/test/build, then full monorepo typecheck/test/build/lint.
- Added Product accessibility/quality regression coverage for Persian RTL, explicit LTR identifiers, keyboard row selection, Escape/dialog semantics, loading/validation accessibility, Phase 14 density tokens, responsive layout and local overflow.
- Updated Documentation Governance with a permanent one-canonical-phase-file rule to prevent step-document sprawl. Step-specific temporary Phase 18 evidence files were consolidated into this record and removed; Git history remains the historical record.
- Updated `ROADMAP.md`, Product glossary terms and canonical database design; Product architecture/security documents created earlier in the phase remain the canonical cross-cutting references.
- Repository owner accepted Step 19 and authorized Step 20 finalization on 2026-09-01. No GitHub Actions status checks are configured on the phase branch; validation remains represented by the explicit local `pnpm validate:phase18` gate and owner acceptance rather than an unobserved CI claim.

### Step 20 — Final Review, Merge, and Release

- Reconciled the full Phase 18 branch against the Phase 17 `develop`/`main` baseline and retained only Phase 18 scope.
- Finalized the canonical Phase 18 record, roadmap transition, phase index, and release preparation metadata.
- Approved promotion path follows the established repository strategy: `phase/18-products-services` → `develop` → `main` using merge commits through GitHub pull requests.
- Semantic release target is `v0.18.0`.
- Tag creation and GitHub Release publication are intentionally excluded from automated Step 20 execution at the repository owner's request and must be performed manually after verifying the final `main` head.

## Architecture and cross-cutting documentation

- `docs/architecture/product-sync-contract.md`
- `docs/architecture/product-selector-contract.md`
- `docs/architecture/product-shared-platform-integration.md`
- `docs/security/product-security-and-approval.md`
- `docs/database/database-design.md`
- `docs/glossary/domain-glossary.md`

No new ADR is required for Phase 18 itself: the phase follows existing offline-first, shared-platform, Master Data, security/audit and Phase 14 UI decisions; Product-specific architecture decisions are documented in the canonical architecture/security records above.

## Validation gate

Canonical Phase 18 validation command:

```bash
pnpm install --frozen-lockfile
pnpm validate:phase18
```

Before manually publishing the tag/release, the repository owner should run the command above on the final `main` head if it has not already been run after the last documentation-only commits.

## Release preparation

- Version: `0.18.0`
- Semantic tag: `v0.18.0`
- Release title: `ArginAccounting v0.18.0 — Products and Services`
- Next roadmap target: Phase 19 — Warehouses

## Change Requests

### CR-18-001 — Versioned Taxpayer Unit Reference Data — Approved

Seed official Taxpayer unit title/code reference data as versioned SQLite reference data; preserve historical codes via deactivation, keep Product `unitId`/code separate from official Taxpayer code, and allow future authorized dataset upgrades without redesigning Product Unit identity.

No other change to the frozen sequence is approved.
