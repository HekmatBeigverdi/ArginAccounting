# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–19 are completed. Step 20 is not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

This file is the canonical Phase 19 record. The additional Warehouse/Zone/Location maintenance completed under Step 14 was previously agreed Phase 19 scope and did not alter the frozen sequence.

Cross-cutting governance remains defined by:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

## Objective

Deliver canonical Warehouse Master Data and desktop management with durable identity, company/Branch-aware organizational scope, lifecycle, classification, extensible physical structure, dependency-safe maintenance, duplicate-safe identifiers, persistence-neutral Domain/Application contracts, SQLite persistence, authorization/audit, import/export, reusable selectors, explicit ERP ownership boundaries, quality gates and future Argin Bridge compatibility.

Future topology remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization remains outside Phase 19.

## Baseline and Release Target

- Branch: `phase/19-warehouses`
- Version: `0.19.0`
- Tag: `v0.19.0`
- Release title: `ArginAccounting v0.19.0 — Warehouses`

## Scope

Phase 19 owns Warehouse Master Data and future-consumer contracts, including:

- durable `warehouseId`, `zoneId` and `locationId`
- Company/Branch organizational scope
- Warehouse classification and lifecycle
- optional `Warehouse -> Zone -> Location` physical hierarchy with nested Locations
- edit/status/delete/restore/move maintenance rules
- code/external-identifier normalization and duplicate rules
- dependency guards for destructive/status/move operations
- persistence-neutral Application/Query/Repository/UoW contracts
- validation, idempotency and optimistic concurrency
- SQLite persistence, atomic transactions and tombstone-compatible deletion
- permissions/audit, import/export, Persian RTL desktop management and selectors
- Inventory/ERP integration boundaries
- Argin Bridge-compatible Warehouse and physical-structure change contracts without the live sync engine

## Explicit Non-Scope

Phase 19 does not implement stock balances, kardex, receipt/issue/transfer transactions, stock count, valuation/cost layers, inventory accounting postings, purchasing/sales document workflow, manufacturing transactions, Taxpayer submission/signing/inquiry, or live synchronization/conflict-resolution UI.

Future Inventory/Purchase/Sales/Manufacturing modules must plug concrete dependency probes into the Warehouse dependency-guard contract before destructive/status/move operations are allowed against referenced master data.

## Identity and Argin Bridge Rules

- `warehouseId`, `zoneId` and `locationId` are durable identities; codes/titles are mutable business metadata.
- Warehouse code/title/Branch title/external identifier/UI labels are never downstream foreign identity.
- Product identity remains owned by Phase 18.
- Warehouse remains compatible with durable IDs, optimistic versions, deterministic timestamps, idempotent mutations, Company isolation, tombstones, origin metadata and future server revisions.
- Root Warehouse deletion uses `warehouses.deleted_at`; Zone/Location deletion uses migration `0025_warehouse_maintenance_tombstones.sql`.
- Physical Argin Bridge envelopes support `upsert` and `tombstone`; outbox, transport, retry, acknowledgement and conflict resolution remain the synchronization phase.

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
| 15 | Warehouse Selector and Future Consumer Contract | Completed |
| 16 | Inventory and ERP Integration Boundaries | Completed |
| 17 | Domain and Application Tests | Completed |
| 18 | Repository, Migration, Import/Export and Desktop Tests | Completed |
| 19 | Performance, Accessibility, Monorepo Quality and Documentation | Completed |
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

## Consolidated Completion Records

### Steps 1–6 — Domain and Master-Data Foundation

- Froze Phase 19 scope and branch/release target.
- Added independent `@argin/warehouse` with immutable Warehouse snapshots and durable Company-owned identity.
- Added Warehouse classifications and `active/inactive/archived` lifecycle.
- Added company-wide or single-Branch organizational scope with same-Company active-Branch validation.
- Added durable Zone/Location hierarchy with optional nested Location parentage.
- Added Company-scoped Warehouse code uniqueness and namespaced external identifiers while preserving durable IDs as identity.

### Steps 7–11 — Application and Persistence

- Added persistence-neutral commands, DTOs, bounded queries, Reader, repositories and Unit of Work contracts.
- Added `WarehouseService` with request idempotency, duplicate checks, optimistic concurrency, Branch resolution and lifecycle/scope orchestration.
- Added migrations `0022_warehouses.sql`, `0023_warehouse_sync_metadata.sql` and `0024_warehouse_idempotency.sql`.
- Added Warehouse/Zone/Location SQLite repositories, bounded Reader, Branch resolver, SQL compare-and-swap optimistic updates, atomic UoW and durable replay-safe idempotency.
- Added Warehouse Argin Bridge `upsert`/`tombstone` contracts without implementing network synchronization.

### Step 12 — Permissions, Audit and Approval Integration

- Added Warehouse permission catalog entries and secured read/mutation wrappers.
- Added retry-safe Warehouse Audit events and stable unauthorized error mapping.
- Warehouse Master Data does not intrinsically require Approval; `warehouseApprovalIntegration.mode` remains `not-required` unless a future explicit domain requirement changes it.

### Step 13 — Import / Export and Initial Warehouse Setup

- Added previewable Warehouse bulk import with atomic and best-effort modes.
- Added persisted and in-batch duplicate detection for code/external identifiers.
- Added bounded export through `WarehouseReaderBulkExportAdapter`.
- Added deterministic one-time default Company Warehouse setup (`MAIN` / `انبار اصلی`) without creating stock state.

### Step 14 — Persian RTL Warehouse Management UI

- Added `WarehousesPage` at `/inventory/warehouses` with Phase 14 dense Persian RTL layout, Persian-calendar display and explicit LTR code/identifier rendering.
- Added create/edit/status/archive/restore/delete operations for Warehouse.
- Added create/edit/activate/deactivate/delete for Zone and Location.
- Added controlled Location parent change and explicit cross-Zone/cross-Warehouse Location move with ancestry-cycle prevention.
- Added `WarehouseDependencyGuard` and protected destructive/status/move operations.
- Added tombstone-compatible Warehouse/Zone/Location deletion and migration `0025_warehouse_maintenance_tombstones.sql`.
- Added physical `upsert`/`tombstone` sync envelopes for future Argin Bridge propagation.

### Step 14 Maintenance Rules

| Operation | Phase 19 rule |
| --- | --- |
| Edit Warehouse | Optimistic Warehouse version rules apply. |
| Edit Zone | Code/title/description may change through Application service. |
| Edit Location | Code/title/description/kind may change through Application service. |
| Deactivate/Archive Warehouse | Dependency guard must allow the operation. |
| Deactivate Zone | No active Location below it + dependency guard allows. |
| Deactivate Location | No active descendant + dependency guard allows. |
| Delete Warehouse | No structural Zone/Location dependency + external dependency guard allows; write tombstone. |
| Delete Zone | No Location under Zone + external dependency guard allows; write tombstone. |
| Delete Location | No child Location + external dependency guard allows; write tombstone. |
| Change Location parent | Controlled move; ancestry cycle is rejected. |
| Move Location to another Zone/Warehouse | Explicit validated operation; implicit subtree transfer is rejected. |
| Inventory/document dependency check | Contract is frozen now; future owning modules supply concrete probes. |
| Argin Bridge propagation | Upsert/tombstone contracts exist; live sync remains future scope. |

### Step 15 — Warehouse Selector and Future Consumer Contract

- Added approved selector consumers: Inventory, Purchases, Sales, Manufacturing, Transfer and Adjustment.
- Added immutable Warehouse/Zone/Location selection references based on durable IDs.
- Normal selection is active-only and tombstones are excluded.
- Without `branchId`, selection is company-wide-only; with `branchId`, the selected Branch plus optional company-wide Warehouses are eligible.
- Added reusable accessible Persian RTL `WarehouseSelector` with bounded results, deferred/race-safe search and keyboard combobox/listbox behavior.

### Step 16 — Inventory and ERP Integration Boundaries

- Added `WarehouseOperationalReference` containing durable `warehouseId` and optional `zoneId`/`locationId`, deliberately excluding mutable display identity.
- Warehouse owns master definitions/scope/lifecycle/physical hierarchy/selection eligibility only.
- Inventory owns balances/movements/kardex/reservations/counts; valuation owns cost layers; Purchases/Sales own documents/prices; Transfer/Adjustment own their transaction workflows; Manufacturing/Cost Accounting own production/cost workflows; Accounting owns posting; Taxpayer owns projection/signing/submission/inquiry.
- Dependency direction is forward-only: future ERP modules consume public Warehouse contracts; `@argin/warehouse` must not import their transactional models.
- Canonical architecture record: `docs/architecture/warehouse-inventory-erp-integration.md`.

### Step 17 — Domain and Application Tests

- Consolidated persistence-neutral coverage for lifecycle, scope, identifiers, hierarchy, maintenance, cycle prevention, restore, selectors, security/audit, sync and ERP boundaries.
- Added explicit wrong-Company mutation isolation, multi-step optimistic-version chains, invalid-context-before-UoW checks, idempotency scope isolation and dependency-guard precedence regressions.

### Step 18 — Repository, Migration, Import/Export and Desktop Tests

- Added real `node:sqlite` migration coverage for migrations 22–25 and Desktop runner registration.
- Added real SQLite UoW rollback and Import → persistence → Export integration coverage.
- Added tombstone exclusion for Warehouse/Zone/Location ordinary reads.
- Added persistence-level Company/Branch selector regression before `LIMIT`.
- Added Desktop composition regression ensuring Warehouse UI uses public Application/SQLite adapter boundaries rather than direct Warehouse SQL.

### Step 19 — Performance, Accessibility, Monorepo Quality and Documentation

- Added `@argin/warehouse-tauri validate:performance` via `scripts/validate-warehouse-performance.ts`.
- Performance validation builds a representative dataset of 50,000 Warehouses, including 40,000 Company-scoped test rows, plus 5,000 Zones and 20,000 Locations.
- SQLite `EXPLAIN QUERY PLAN` must use accepted indexes for:
  - Company/status Warehouse list
  - Branch-scoped Warehouse selector
  - external-identifier duplicate lookup
  - Zone lookup
  - Location lookup
- Performance acceptance is based on bounded queries and expected index use, not hardware-specific wall-clock timing.
- Added `warehouse-step19-quality.test.ts` covering Persian RTL, explicit LTR identifiers, Persian-calendar presentation, focus-visible behavior, Warehouse selector keyboard/ARIA semantics, semantic confirmation dialog behavior, dense sizing, local overflow, responsive collapse, loading/empty/error/success feedback and race-safe bounded selector lookup.
- Added root `pnpm validate:phase19` as the canonical Phase 19 quality gate. It runs Warehouse and Warehouse-Tauri typecheck/tests, Warehouse performance validation, Security/Audit checks, Desktop typecheck/test/build, then full monorepo typecheck/test/build/lint.
- Updated `ROADMAP.md` with Phase 19 implementation/quality status while retaining Phase 19 as the current target until Step 20 promotion.
- Updated `docs/glossary/domain-glossary.md` with canonical Warehouse/Zone/Location/selector/operational-reference/dependency-guard/tombstone terminology.
- Updated `docs/database/database-design.md` with migrations 22–25, Warehouse persistence boundaries, indexing/performance rules, transaction semantics and future PostgreSQL/Argin Bridge compatibility.
- Existing architecture records remain canonical:
  - `docs/architecture/warehouse-sync-contract.md`
  - `docs/architecture/warehouse-inventory-erp-integration.md`
- No new ADR is required: Phase 19 follows existing offline-first, Master Data, shared security/audit, database abstraction, Phase 14 UI and future-sync decisions.
- No stock transaction, valuation, posting, Taxpayer transport or live synchronization behavior was introduced by the quality/documentation step.

### Step 19 Exit Criteria

Step 19 is complete when:

- a representative Warehouse/Zone/Location SQLite performance validator is committed;
- critical list/selector/duplicate/physical lookup plans require accepted indexes;
- Warehouse Desktop quality contracts cover RTL/LTR, dense layout, focus, responsive behavior, feedback and reusable selector accessibility;
- one root `validate:phase19` command covers Warehouse, infrastructure, Desktop and full monorepo quality gates;
- Roadmap, glossary and canonical database documentation reflect Phase 19 architecture and persistence;
- Step 20 remains the only unfinished phase step.

All Step 19 implementation and documentation artifacts are committed. The assistant environment could not execute the repository validation commands because network/DNS prevents cloning/installing the repository there. Therefore this record does **not** claim a passing runtime result; local execution of the gate below is required before final merge/release acceptance.

## Validation Gate

Canonical Phase 19 validation commands:

```bash
pnpm install --frozen-lockfile
pnpm validate:phase19
```

If the lockfile changes because the Phase 19 workspace packages were not previously captured, run `pnpm install`, review and commit the legitimate `pnpm-lock.yaml` update, then rerun the frozen-lockfile command.

## Change Requests

No Change Request is currently approved for Phase 19.
