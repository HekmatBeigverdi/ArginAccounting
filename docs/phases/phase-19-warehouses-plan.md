# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–14 are completed. Steps 15–20 are not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

This file is the canonical Phase 19 record. The additional Warehouse/Zone/Location maintenance work recorded under Step 14 is completion of previously agreed Phase 19 scope, not a sequence change.

Cross-cutting governance remains defined by:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

## Objective

Deliver canonical Warehouse Master Data and desktop management with durable identity, company/branch-aware organizational scope, lifecycle, classification, extensible physical-location boundaries, dependency-safe maintenance, duplicate-safe identifiers, persistence-neutral Domain/Application contracts, SQLite persistence, authorization/audit, import/export, reusable selectors, and future Argin Bridge compatibility.

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

- durable `warehouseId`, `zoneId` and `locationId`
- company/branch organizational scope
- Warehouse classification and lifecycle
- Zone/Location physical master data and nested Location parentage
- edit/status/delete/move maintenance rules for physical structure
- code/external-identifier normalization and duplicate rules
- dependency guards for destructive/status/move operations
- persistence-neutral Application/Query/Repository/UoW contracts
- validation, idempotency and optimistic concurrency
- SQLite persistence, atomic transactions and tombstone-compatible deletion
- permissions/audit, import/export, dense Persian RTL UI, selectors and integration boundaries
- Argin Bridge-compatible Warehouse and physical-structure change contracts without implementing the sync engine

## Explicit Non-Scope

Phase 19 does not implement stock balances, kardex, receipt/issue/transfer transactions, stock count, valuation/cost layers, inventory accounting postings, purchasing/sales document logic, manufacturing transactions, Taxpayer submission/signing/inquiry, or live synchronization/conflict-resolution UI.

Those future modules must plug their real dependency probes into the Warehouse dependency-guard contract before destructive/status/move operations are allowed against referenced master data.

## Identity and Argin Bridge Rules

- `warehouseId`, `zoneId` and `locationId` are durable identities; codes/titles are mutable business metadata.
- Warehouse code/title/Branch title/external identifier/UI labels are not foreign identity.
- Product identity remains owned by Phase 18 and is consumed through public contracts.
- Warehouse remains compatible with durable IDs, optimistic versions, deterministic timestamps, idempotent mutations, Company isolation, tombstones, origin metadata and future server revisions.
- Root Warehouse deletion uses the existing `warehouses.deleted_at` tombstone.
- Zone and Location deletion uses migration `0025_warehouse_maintenance_tombstones.sql` and remains excluded from ordinary reads.
- Physical Argin Bridge envelopes support `upsert` and `tombstone`; actual outbox, transport, retry, acknowledgement and conflict resolution remain in the synchronization phase.

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
Added approved classifications and `active/inactive/archived` lifecycle with terminal archive semantics and idempotent same-state transitions.

### Step 4 — Company, Branch and Organizational Scope
Added company-wide or single-Branch discriminated scope, same-company active-Branch validation and archived-scope-change protection.

### Step 5 — Warehouse Locations and Extensible Physical Structure
Added durable Zone/Location hierarchy with optional nested Location parentage and no inventory-state leakage.

### Step 6 — Warehouse Codes, Identifiers and Duplicate Rules
Added Company-scoped normalized code uniqueness, namespaced external identifiers and deterministic duplicate rules while preserving durable IDs as identity.

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
Added persistence-neutral bulk import/export contracts, preview and row issues, persisted/in-batch duplicate checks, atomic and best-effort modes, bounded full-field export, Reader export adapter and deterministic one-time Company default Warehouse setup (`MAIN` / `انبار اصلی`) with Permission/Audit integration.

### Step 14 — Persian RTL Warehouse Management UI

Step 14 delivers the production Persian RTL Desktop management surface and completes the previously agreed maintenance rules for Warehouse, Zone and Location.

Completed actions:

- Added `WarehousesPage` at `/inventory/warehouses`, navigation integration, Company-scoped dense list/detail workspace, Persian labels, Persian-calendar display and explicit LTR code/identifier rendering.
- Composed secured Application services and SQLite adapters instead of direct SQL mutation from React.
- Added Warehouse create/edit, lifecycle controls, Branch/company scope selection, external identifiers, optimistic version display and persistent Audit integration.
- Added Zone and Location tabs inside Warehouse detail.
- Added create and **edit** for Zone code, title and description.
- Added create and **edit** for Location code, title, description and Location kind.
- Added Zone **activate/deactivate** operations.
- Added Location **activate/deactivate** operations.
- Added `inventory.warehouses.delete` as a separate permission for destructive Warehouse deletion; Zone/Location maintenance continues under `inventory.warehouses.manage-locations`.
- Added dependency-safe user Delete operations for Warehouse, Zone and Location. User-facing Delete is persisted as tombstone-compatible soft deletion rather than unrecoverable row destruction.
- Warehouse deletion is blocked while non-deleted Zones/Locations exist and also invokes the future-consumer dependency guard.
- Zone deletion is blocked while Locations remain underneath it and also invokes the dependency guard.
- Location deletion is blocked while it has child Locations and also invokes the dependency guard.
- Added `WarehouseDependencyGuard` for future stock/document/reference probes with blocker kinds covering stock balance, Inventory documents, Purchase documents, Sales documents, Manufacturing documents, accounting references and other consumers.
- Warehouse deactivate/archive/delete, Zone deactivate/delete, and Location deactivate/delete/move call the dependency guard. The default pre-Inventory implementation has no external blockers because those modules do not yet exist; future modules must supply concrete probes without changing the Warehouse public contract.
- Zone deactivation is blocked while active Locations exist under the Zone.
- Location deactivation is blocked while active descendants exist below it.
- Added Location parent-change support as a controlled move operation rather than direct field mutation.
- Added ancestry traversal and cycle detection; a Location cannot become its own parent or be moved below one of its descendants.
- Added independent Location transfer to another Zone or another Warehouse. Target Warehouse must be usable, target Zone must be active and belong to the target Warehouse, and optional parent must be active and belong to the same target Zone.
- Cross-Zone/Cross-Warehouse transfer of a Location that still has descendants is intentionally blocked; Phase 19 does not silently move an entire subtree as a side effect of moving one node.
- Added migration `0025_warehouse_maintenance_tombstones.sql` with `deleted_at` for Zone/Location, tombstone indexes and active lookup indexes; registered as desktop migration version 25.
- Updated SQLite repositories/readers so tombstoned Warehouse/Zone/Location records are excluded from normal reads and move/delete writes are scope-safe.
- Root Warehouse uses the Step 10 `warehouses.deleted_at` field and increments Warehouse version on deletion with optimistic-CAS semantics.
- Added retry-safe Audit actions for Warehouse delete, Zone update/status/delete and Location update/status/move/delete.
- Added transport-neutral `WarehousePhysicalSyncEnvelope` contracts for Zone/Location `upsert` and `tombstone` changes, carrying Company/Warehouse/entity identity, request/idempotency identity, origin and change timestamp.
- Actual Argin Bridge outbox/transport, server acknowledgement, retry scheduling and conflict resolution remain outside Phase 19's sync implementation scope.
- Added focused maintenance Domain tests for edit/status/move/cycle rules and Desktop contract tests for migration-25 registration, tombstones and agreed UI maintenance actions.
- Existing in-memory test repositories were updated to satisfy the expanded persistence contract so Step 14 does not invalidate earlier Step 8/13 test fixtures.

### Step 14 Maintenance Rules

| Operation | Phase 19 rule |
| --- | --- |
| Edit Warehouse | Existing optimistic-version rule applies. |
| Edit Zone | Code/title/description may change through Application service. |
| Edit Location | Code/title/description/kind may change through Application service. |
| Deactivate Warehouse | Dependency guard must allow it. |
| Archive Warehouse | Dependency guard must allow it; archive remains distinct from delete/tombstone. |
| Deactivate Zone | No active Locations beneath it + dependency guard allows. |
| Deactivate Location | No active descendants + dependency guard allows. |
| Delete Warehouse | No structural Zone/Location dependency + external dependency guard allows; write tombstone. |
| Delete Zone | No Location under Zone + external dependency guard allows; write tombstone. |
| Delete Location | No child Location + external dependency guard allows; write tombstone. |
| Change Location parent | Same controlled move command; ancestry cycle is rejected. |
| Move Location to another Zone/Warehouse | Explicit operation; target scope validated; external dependency guard checked; implicit subtree transfer is rejected. |
| Inventory/document dependency check | Public guard contract is frozen now; concrete probes are supplied when Inventory/Purchase/Sales/Manufacturing consumers exist. |
| Argin Bridge propagation | Warehouse and physical upsert/tombstone contracts are prepared now; actual sync engine remains future scope. |

### Step 14 Exit Criteria

Step 14 is complete when:

- Warehouse management is reachable from Desktop navigation under the correct permission.
- The page is Persian RTL and codes/identifiers remain explicitly LTR.
- Company-scoped list/search/filter/detail interactions use a dense desktop layout.
- Warehouse/Zone/Location mutations use secured Application services rather than direct SQL writes.
- Zone/Location can be edited, activated/deactivated and safely deleted under explicit structural/dependency rules.
- Location parent changes prevent cycles.
- Location transfer is an explicit validated operation rather than unrestricted field editing.
- Destructive/status/move operations expose the future stock/document dependency boundary now.
- Warehouse/Zone/Location deletions are tombstone-compatible for future Argin Bridge propagation.
- Focused maintenance/UI contract tests are committed.
- Reusable future-consumer Warehouse selector behavior remains reserved for Step 15.

All Step 14 implementation artifacts and focused tests are committed. Full executable Domain/Application/Desktop/monorepo validation and accessibility review remain mandatory in Steps 17–19.

## Change Requests

No Change Request is currently approved for Phase 19.
