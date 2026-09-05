# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–14 are completed. Steps 15–20 are not started.

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
| 14 | Persian RTL Warehouse Management UI | Completed |
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
Added persistence-neutral bulk import/export contracts, preview and row issues, persisted/in-batch duplicate checks, atomic and best-effort modes, bounded full-field export, Reader export adapter and deterministic one-time Company default Warehouse setup (`MAIN` / `انبار اصلی`) with Permission/Audit integration. Zone/Location bulk layout remains intentionally separate from root Warehouse import.

### Step 14 — Persian RTL Warehouse Management UI

Step 14 delivers the production Desktop management surface for Warehouse Master Data while preserving the dense desktop ergonomics established in Phase 14 and keeping future consumer selection behavior in Step 15.

Completed actions:

- Added `WarehousesPage` as a Persian `lang="fa"`, `dir="rtl"` Desktop workspace at `/inventory/warehouses`.
- Added permission-aware navigation entry under `انبار و موجودی`, protected by `inventory.warehouses.view`.
- Added `@argin/warehouse` and `@argin/warehouse-tauri` as explicit Desktop workspace dependencies so UI composition uses the public Domain/Application and SQLite adapter boundaries.
- Composed `WarehouseService`, `SqliteWarehouseUnitOfWork`, `SqliteWarehouseReader`, `SqliteWarehouseIdempotencyExecutor` and `SqliteWarehouseBranchResolver` in Desktop rather than embedding persistence behavior in React components.
- Wrapped reads/mutations through the Step 12 secured Warehouse contracts; action buttons respect create/update/status/scope/location permissions.
- Added a persistent Warehouse Audit adapter that maps Warehouse Audit facts into the existing shared append-only Audit infrastructure.
- Added a dense searchable/filterable Warehouse table with 50-row paging, sticky header, keyboard-selectable rows and explicit selected-row state.
- Added filters for search, Warehouse classification and lifecycle status while keeping results Company-scoped.
- Added split Desktop workspace with Warehouse list and detail panel to reduce full-page navigation and excessive horizontal/vertical scrolling.
- Added detail metadata for classification, lifecycle, organizational scope, optimistic version, last update, external identifiers and description.
- Added Persian labels for all approved Warehouse classifications and lifecycle statuses.
- Added explicit `dir="ltr"` treatment and monospace presentation for Warehouse codes, versions and external identifiers while the surrounding UI remains RTL.
- Added Persian-calendar date/time presentation for Warehouse timestamps while persisted values remain canonical Gregorian/UTC strings.
- Added create/edit dialog for Warehouse code/title/description, classification, organizational scope and external identifiers.
- Warehouse classification is immutable in edit UI because the current Domain/Application contract does not expose a classification-change mutation; the UI does not bypass Domain rules.
- Added active Company Branch loading and Branch dropdown selection for Branch-scoped Warehouses instead of exposing raw Branch IDs as the normal user interaction.
- Added lifecycle controls for activate, deactivate and terminal archive, respecting current Warehouse status and permission availability.
- Added physical-structure tabs for Zones and Locations inside the selected Warehouse detail panel.
- Added Zone creation and Location creation dialogs, including Location kind, Zone selection and optional parent Location for extensible Rack/Shelf/Bin-style hierarchy.
- Archived Warehouses cannot expose edit or physical-structure mutation actions in the UI.
- Added responsive fallbacks while retaining the primary desktop two-panel dense layout at normal accounting-workstation widths.
- Added focused Desktop UI contract tests that lock the Warehouse route/permission, Persian RTL surface, explicit LTR identifiers and dense workspace layout tokens.
- UI copy explicitly states that this screen owns Warehouse/physical master data and does not implement inventory quantities or movements.
- Step 15 selector behavior, stock transactions, kardex, valuation, posting and synchronization UI remain outside Step 14.

### Step 14 Exit Criteria

Step 14 is complete when:

- Warehouse management is reachable from Desktop navigation under the correct permission.
- The page is Persian RTL and codes/identifiers remain explicitly LTR.
- Company-scoped Warehouse list/search/filter/detail interactions are available in a dense desktop layout.
- Create/edit/lifecycle/scope mutations use secured Application services rather than direct SQL writes.
- Active Branches can be selected by user-facing code/title, not raw identifier entry.
- Zone/Location physical structure can be viewed and extended without introducing inventory state.
- Archived Warehouse restrictions are reflected in available UI actions.
- Warehouse Audit events are persisted through the shared Audit subsystem.
- Focused route/RTL/density UI contract tests are committed.
- Reusable Warehouse selector behavior remains reserved for Step 15.

All Step 14 implementation artifacts and focused tests are committed. Full executable Desktop/monorepo validation, accessibility review and generated lockfile normalization remain mandatory in Steps 18–19.

## Change Requests

No Change Request is currently approved for Phase 19.
