# Phase 18 — Products and Services — Fixed Implementation Plan

## Status

Phase 18 is active. Steps 1–17 are completed; Steps 18–20 are not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

Before every step, follow:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

The detailed historical plan and Evidence through Step 14 are preserved verbatim at:

- `docs/phases/archive/phase-18-products-services-plan-through-step-14.md`

Later detailed evidence is recorded in:

- Step 15: `docs/phases/phase-18-step-15-selector.md`
- Step 16: `docs/phases/phase-18-step-16-integration-boundaries.md`
- Step 17: `docs/phases/phase-18-step-17-domain-application-tests.md`
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
| 18 | Repository, Migration, Import/Export, and Desktop Tests | Not started |
| 19 | Monorepo, Performance, Accessibility, Quality, and Documentation | Not started |
| 20 | Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Plan Freeze
Freeze branch, objective, dependencies, scope, exclusions, Argin Bridge constraints, governance rules, and this complete sequence.

Exit: branch and fixed plan exist with no Product business behavior.

### Step 2 — Product and Service Domain Model
Define Product/Service aggregate, durable identity, company scope, display code/title, classification and invariant boundaries.

Exit: persistence-neutral aggregate is explicit and tested.

### Step 3 — Classification, Status, and Lifecycle
Define category/grouping, active/inactive lifecycle, purchasable/sellable eligibility, and keep tombstones separate from business status.

Exit: lifecycle/classification rules are deterministic.

### Step 4 — Units of Measure and Conversion Rules
Define base/alternate units, deterministic ratios, precision and rounding, rejecting invalid/ambiguous conversion semantics.

Exit: UoM behavior is persistence-neutral and deterministic.

### Step 5 — Codes, Barcodes, and Official Identifiers
Define internal/display code, SKU/reference, barcodes, external identifiers, Taxpayer goods/service ID and official unit mappings.

Exit: identifiers are normalized and downstream-safe.

### Step 6 — Commercial, Tax, and Operational Master Data
Define reusable commercial, tax and operational eligibility attributes without balances, prices, stock quantities or posting state.

Exit: downstream modules can consume stable master attributes.

### Step 7 — Application, Query, and Repository Contracts
Define commands, queries, DTOs, readers/repositories, paging/sorting/filtering/selectors, Unit of Work and stable errors; no unbounded `findAll()`.

Exit: contracts are storage/transport neutral.

### Step 8 — Application Services, Validation, and Duplicate Detection
Implement mutation services, strong/advisory duplicate handling, expected-version and idempotency boundaries.

Exit: Application behavior is deterministic, concurrency-aware and duplicate-safe.

### Step 9 — Migration, Schema, Constraints, and Indexing
Add versioned SQLite schema, company-scoped constraints and indexes aligned with Domain/Application contracts.

Exit: persistence schema is structurally correct and queryable at scale.

### Step 10 — Argin Bridge and Future Synchronization Contract
Define stable identity/version/change/tombstone/external-reference/idempotency envelope without implementing network synchronization.

Exit: future Bridge integration requires no Product identity redesign.

### Step 11 — SQLite Repository, Unit of Work, and Atomic Transactions
Implement SQLite mapping, transaction-backed UoW, optimistic concurrency, duplicate/list/selector/reference adapters.

Exit: SQLite persistence is atomic, bounded and adapter-compatible.

### Step 12 — Permissions, Audit, and Approval Integration
Enforce granular permissions at Application boundary, record successful writes through shared Audit, and reuse Approval only if a justified lifecycle exists.

Exit: security is not UI-only and writes are auditable.

### Step 13 — Bulk Import and Export
Provide CSV/XLSX preview/mapping/normalization/validation/duplicate diagnostics/atomic mode and bounded export.

Exit: large master-data exchange is safe and diagnosable.

### Step 14 — Persian RTL Product/Service Management UI
Provide dense Persian RTL list/search/filter/detail/create/edit workflow following Phase 14 density, accessibility and error-state standards.

Exit: Product/Service management is usable and consistent with desktop standards.

### Step 15 — Product/Service Selector and Future Module Consumption Contract
Provide reusable bounded selector profiles for future Inventory/Purchase/Sales/Taxpayer/Manufacturing/Cost Accounting consumers using durable `productId`.

Exit: downstream modules can reference Product without SQLite/UI coupling.

### Step 16 — Shared Platform and ERP Integration Boundaries
Verify reuse of Company/Branch, Security, Audit, Query/UoW/concurrency and define ownership boundaries with Party and future ERP modules.

Exit: no shared capability is duplicated and downstream ownership is explicit.

### Step 17 — Domain and Application Tests
Cover classification, lifecycle, UoM/conversions, identifiers, master attributes, validation, duplicates, idempotency, concurrency, company isolation and Application services.

Exit: core business behavior is covered independently of SQLite/Desktop.

### Step 18 — Repository, Migration, Import/Export, and Desktop Tests
Cover migrations/upgrades, repository mapping, constraints/indexes, rollback/concurrency, duplicate queries, import/export, selectors and Desktop RTL/density/keyboard/error paths.

Exit: persistence and user-facing integration paths are validated end to end.

### Step 19 — Monorepo, Performance, Accessibility, Quality, and Documentation
Run focused/monorepo tests, typecheck, lint, build, Desktop/Tauri checks, representative query-plan/performance validation, accessibility/RTL/density validation, links and mandatory documentation/release preparation.

Exit: technical validation and documentation obligations are complete.

### Step 20 — Final Review, Merge, and Release
Reconcile status, run final validation, review branch scope, merge through approved strategy and prepare/publish semantic release `v0.18.0` as authorized.

Exit: Phase 18 is merged, validated, documented and released.

## Change Requests

### CR-18-001 — Versioned Taxpayer Unit Reference Data — Approved

Seed official Taxpayer unit title/code reference data as versioned SQLite reference data; preserve historical codes via deactivation, keep Product `unitId`/code separate from official Taxpayer code, and allow future authorized dataset upgrades without redesigning Product Unit identity.

No other change to the frozen sequence is approved.
