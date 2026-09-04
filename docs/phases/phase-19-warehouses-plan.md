# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–13 are completed. Steps 14–20 are not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

This file is the canonical Phase 19 record. Cross-cutting governance remains defined by:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

## Objective

Deliver canonical Warehouse Master Data and desktop management with durable identity, company/branch-aware organizational scope, lifecycle, classification, extensible physical-location boundaries, duplicate-safe identifiers, persistence-neutral Domain/Application contracts, SQLite persistence, authorization/audit, import/export, reusable selectors, and future Argin Bridge compatibility.

Future topology remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization is outside Phase 19.

## Baseline

- Branch: `phase/19-warehouses`
- Version: `0.19.0`
- Tag: `v0.19.0`
- Release title: `ArginAccounting v0.19.0 — Warehouses`

## Scope

Phase 19 owns Warehouse Master Data and future-consumer contracts, including:

- durable `warehouseId`
- company/branch organizational scope
- warehouse classification and lifecycle
- Zone/Location physical master data
- code/external-identifier normalization and duplicate rules
- persistence-neutral Application/Query/Repository/UoW contracts
- validation, idempotency and optimistic concurrency
- SQLite persistence and atomic transactions
- permissions/audit, import/export, dense Persian RTL UI, selectors and integration boundaries
- Argin Bridge compatibility without implementing the sync engine

## Explicit Non-Scope

Phase 19 does not own stock balances, kardex, receipt/issue/transfer transactions, stock count, valuation/cost layers, inventory accounting postings, purchasing/sales documents and prices, manufacturing transactional logic, Taxpayer submission/signing/inquiry, or live synchronization/conflict-resolution UI.

## Identity and Argin Bridge Rules

- `warehouseId` is the durable downstream identity.
- Warehouse code/title/Branch title/external identifier/UI labels are not foreign identity.
- Product identity remains owned by Phase 18 and is consumed through public contracts.
- Warehouse remains compatible with durable IDs, optimistic versions, deterministic timestamps, idempotent mutations, Company isolation, future tombstones, origin metadata and optional server revision.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Warehouse Domain Model | Completed |
| 3 | Warehouse Classification, Lifecycle and Business Rules | Completed |
| 4 | Company, Branch and Organizational Scope | Completed |
| 5 | Warehouse Locations and Extensible Physical Structure | Completed |
| 6 | Warehouse Codes, Identifiers and Duplicate Rules | Completed |
| 7 | Application, Query and Repository Contracts | Completed |
| 8 | Application Services, Validation and Concurrency | Completed |
| 9 | Migration, Schema, Constraints and Indexing | Completed |
| 10 | Argin Bridge and Future Synchronization Contract | Completed |
| 11 | SQLite Repository, Unit of Work and Atomic Transactions | Completed |
| 12 | Permissions, Audit and Approval Integration | Completed |
| 13 | Import / Export and Initial Warehouse Setup | Completed |
| 14 | Persian RTL Warehouse Management UI | Not started |
| 15 | Warehouse Selector and Future Consumer Contract | Not started |
| 16 | Inventory and ERP Integration Boundaries | Not started |
| 17 | Domain and Application Tests | Not started |
| 18 | Repository, Migration, Import/Export and Desktop Tests | Not started |
| 19 | Performance, Accessibility, Monorepo Quality and Documentation | Not started |
| 20 | Final Review, Merge and Release | Not started |

## Fixed Execution Sequence

1. Baseline, Branch, Scope and Plan Freeze
2. Warehouse Domain Model
3. Warehouse Classification, Lifecycle and Business Rules
4. Company, Branch and Organizational Scope
5. Warehouse Locations and Extensible Physical Structure
6. Warehouse Codes, Identifiers and Duplicate Rules
7. Application, Query and Repository Contracts
8. Application Services, Validation and Concurrency
9. Migration, Schema, Constraints and Indexing
10. Argin Bridge and Future Synchronization Contract
11. SQLite Repository, Unit of Work and Atomic Transactions
12. Permissions, Audit and Approval Integration
13. Import / Export and Initial Warehouse Setup
14. Persian RTL Warehouse Management UI
15. Warehouse Selector and Future Consumer Contract
16. Inventory and ERP Integration Boundaries
17. Domain and Application Tests
18. Repository, Migration, Import/Export and Desktop Tests
19. Performance, Accessibility, Monorepo Quality and Documentation
20. Final Review, Merge and Release

## Completion Records

### Step 1 — Baseline, Branch, Scope and Plan Freeze
Established the Phase 19 branch, canonical plan, frozen sequence, scope/non-scope, release target, Phase 18 dependency boundary and mandatory Argin Bridge compatibility.

### Step 2 — Warehouse Domain Model
Added independent `@argin/warehouse`, immutable Warehouse snapshots, durable Warehouse identity, Company ownership and normalized core fields/timestamps.

### Step 3 — Warehouse Classification, Lifecycle and Business Rules
Added approved Warehouse classifications and `active/inactive/archived` lifecycle with terminal archive semantics and idempotent same-state transitions.

### Step 4 — Company, Branch and Organizational Scope
Added company-wide or single-Branch discriminated scope, same-company active-Branch validation and archived-scope-change protection.

### Step 5 — Warehouse Locations and Extensible Physical Structure
Added durable Zone/Location hierarchy with optional nested Location parentage and no inventory-state leakage.

### Step 6 — Warehouse Codes, Identifiers and Duplicate Rules
Added Company-scoped normalized code uniqueness, namespaced external identifiers and deterministic duplicate rules while preserving `warehouseId` as durable identity.

### Step 7 — Application, Query and Repository Contracts
Added persistence-neutral commands, DTOs, bounded queries, Reader, Warehouse/Zone/Location repositories, version-aware updates and UoW contracts.

### Step 8 — Application Services, Validation and Concurrency
Added `WarehouseService`, request idempotency, Branch resolution, duplicate checks, optimistic concurrency, lifecycle/scope orchestration and focused Application tests.

### Step 9 — Migration, Schema, Constraints and Indexing
Added migration `0022_warehouses.sql`, Warehouse/identifier/Zone/Location schema, Company/Branch/physical FKs, uniqueness/check constraints, indexes and migration tests.

### Step 10 — Argin Bridge and Future Synchronization Contract
Added persistence-neutral Warehouse upsert/tombstone contracts, origin/server-revision metadata, sync external references, migration `0023_warehouse_sync_metadata.sql` and architecture tests/docs without implementing live synchronization.

### Step 11 — SQLite Repository, Unit of Work and Atomic Transactions
Added `@argin/warehouse-tauri`, SQLite Warehouse/Zone/Location repositories, Reader, Branch resolver, atomic UoW, SQL optimistic concurrency and durable request idempotency through migration `0024_warehouse_idempotency.sql`.

### Step 12 — Permissions, Audit and Approval Integration
Added Warehouse permission catalog entries, secured read/mutation wrappers, stable unauthorized error, retry-safe Audit contracts/actions and explicit `approval: not-required` policy for Warehouse master-data operations.

### Step 13 — Import / Export and Initial Warehouse Setup

Step 13 adds reusable bulk-transfer contracts and deterministic Company onboarding without introducing spreadsheet/UI technology into the Domain/Application package.

Completed actions:

- Added `WarehouseBulkTransferService` and stable import field contract for `code`, `title`, `description`, `kind`, `status`, organizational scope/Branch and namespaced external identifiers.
- Added persistence-neutral tabular-row and column-mapping contracts so CSV/Excel adapters can be attached later without coupling Warehouse logic to a specific file library.
- Added import preview with row numbers, normalized code/title/kind, validity and stable issue information before writes occur.
- Import validates Warehouse Domain rules, approved classification/status values, Company-vs-Branch scope, resolvable Branch references and external-identifier syntax.
- Added hard duplicate detection against persisted Company data for Warehouse code and namespaced external identifiers.
- Added in-batch duplicate detection for case-normalized Warehouse codes and normalized external identifiers so duplicate rows are rejected before persistence.
- Added both atomic and best-effort execution modes. Atomic mode refuses the batch when preview failures exist and performs valid writes through one Warehouse UoW transaction; best-effort mode isolates each row and reports write failures per row.
- Imported rows receive fresh durable `warehouseId` values from an injected ID generator and start at persistence `version = 1`; imported business codes never become durable identity.
- Added bulk Import/Export Audit actions using the Step 12 authorization/audit boundary and existing `inventory.warehouses.import` / `inventory.warehouses.export` permissions.
- Added bounded paged export with a maximum batch size of 200 and complete root Warehouse fields including durable ID, lifecycle/classification, organizational scope, external identifiers, version and timestamps.
- Added `WarehouseReaderBulkExportAdapter` so export can retrieve complete Warehouse DTOs through the persistence-neutral Reader rather than depending directly on SQLite/Tauri.
- Added deterministic `WarehouseInitialSetupService` for Company onboarding. A company with no Warehouse can receive one company-wide active `general` Warehouse with default code `MAIN` and Persian title `انبار اصلی`, with optional code/title/description overrides.
- Initial setup uses injected durable-ID generation, existing Warehouse Service validation/idempotency, `inventory.warehouses.create` authorization and a dedicated `warehouse.initial-setup` Audit fact.
- Initial setup never creates a second default Warehouse when Company data already exists.
- Root Warehouse import/export intentionally does not flatten Zone/Location hierarchy into repeated spreadsheet rows. Physical hierarchy remains separately modeled; any future bulk physical-layout format requires an explicit unambiguous contract rather than implicit row expansion.
- Added focused tests for stable import fields/default setup policy, in-batch code/external-identifier duplicates, atomic Company/Branch imports, status handling and invalid Branch references.
- No UI, file picker, XLSX parser, stock quantity, transaction, valuation, posting, Taxpayer submission or synchronization engine was introduced.

### Step 13 Exit Criteria

Step 13 is complete when:

- Import/export logic is persistence-neutral and does not depend on Excel/CSV libraries.
- Import has a preview stage and deterministic row-level issue reporting.
- Existing-data and same-batch hard duplicates are detected before writes.
- Company/Branch isolation is preserved during import.
- Atomic and best-effort modes have explicit semantics.
- Export is paged, bounded and carries durable identity plus master-data fields.
- Initial Company setup can create one safe default Warehouse without silently creating duplicates.
- Import/export/setup operations use the established Permission and Audit contracts.
- Zone/Location bulk-layout design, UI, inventory transactions and live synchronization remain outside this step.
- Focused Step 13 tests are committed; exhaustive executable validation remains in Steps 17–19.

## Change Requests

No Change Request is currently approved for Phase 19.
