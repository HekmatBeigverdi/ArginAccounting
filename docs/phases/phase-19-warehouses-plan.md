# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–17 are completed. Steps 18–20 are not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

This file is the canonical Phase 19 record. The additional Warehouse/Zone/Location maintenance work recorded under Step 14 is completion of previously agreed Phase 19 scope, not a sequence change.

Cross-cutting governance remains defined by:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

## Objective

Deliver canonical Warehouse Master Data and desktop management with durable identity, company/branch-aware organizational scope, lifecycle, classification, extensible physical-location boundaries, dependency-safe maintenance, duplicate-safe identifiers, persistence-neutral Domain/Application contracts, SQLite persistence, authorization/audit, import/export, reusable selectors, explicit ERP ownership boundaries, and future Argin Bridge compatibility.

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
- permissions/audit, import/export, dense Persian RTL UI, selectors and ERP integration boundaries
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
| 15 | Warehouse Selector and Future Consumer Contract | Completed |
| 16 | Inventory and ERP Integration Boundaries | Completed |
| 17 | Domain and Application Tests | Completed |
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
- Added create/edit/status/delete operations for Zone and Location.
- Added controlled Location parent change and explicit Location transfer across Zone/Warehouse with cycle prevention and target-scope validation.
- Added `inventory.warehouses.delete` as a separate permission for destructive Warehouse deletion; physical maintenance remains under `inventory.warehouses.manage-locations`.
- Added `WarehouseDependencyGuard` for future stock/document/reference probes and enforced it on destructive/status/move operations.
- Added tombstone-compatible deletion for Warehouse, Zone and Location, migration `0025_warehouse_maintenance_tombstones.sql`, ordinary-read filtering and physical Argin Bridge upsert/tombstone envelopes.
- Added restoration support completed in the subsequent Step 14 corrections without changing the frozen sequence.
- Added focused maintenance/UI contract tests and aligned earlier in-memory repository fixtures with the expanded contracts.

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

### Step 15 — Warehouse Selector and Future Consumer Contract

Step 15 freezes the reusable selection boundary that future ERP modules consume instead of inventing module-specific Warehouse lookup rules.

Completed actions:

- Added `WAREHOUSE_SELECTOR_CONSUMERS` with the approved future consumers: `inventory`, `purchases`, `sales`, `manufacturing`, `transfer`, and `adjustment`.
- Added `WarehouseSelectionPolicy`, `WarehouseSelectionReference`, `WarehouseZoneSelectionReference`, and `WarehouseLocationSelectionReference` as persistence-neutral contracts.
- Selection references preserve durable `warehouseId`, `zoneId`, and `locationId`; codes and titles remain display metadata and never become foreign identity.
- Added `buildWarehouseSelectorQuery` with normalized Company/search/kind/limit handling and default active-only eligibility.
- Branch visibility is fail-safe: without `branchId`, selector queries expose only company-wide Warehouses. With `branchId`, only that Branch plus company-wide Warehouses are eligible by default; `includeCompanyWide=false` can explicitly restrict to the Branch only.
- Added `companyWideOnly` to the shared Warehouse query contract and SQLite reader so Branch isolation is enforced by the persistence query itself rather than only by UI filtering.
- Added active-only Zone and Location selector builders. Inactive/tombstoned physical nodes are not eligible for normal future-document selection.
- Added conversion helpers that reject inactive entities and produce immutable durable selection references.
- Added `isWarehouseVisibleToBranch` as a deterministic policy helper for consumers/tests that need eligibility checks outside persistence.
- Existing bounded selector limit remains 1–100 with default 20.
- Added reusable Persian RTL `WarehouseSelector` Desktop component following the existing Party selector interaction pattern: deferred search, race-safe async requests, keyboard navigation, combobox/listbox accessibility, clear action, dense layout and explicit LTR code rendering.
- `WarehouseSelector` accepts `companyId`, optional `branchId`, consumer context, kind restrictions and `includeCompanyWide`, and emits `WarehouseSelectionReference` rather than raw display text.
- The shared selector is intentionally not tied to Inventory/Purchase/Sales document state; future modules compose it with their own transactional rules while preserving the frozen Warehouse eligibility contract.
- Added focused Application contract tests for consumer list, active-only behavior, Company/Branch visibility, durable identity, Zone/Location queries and limit validation.
- Added focused Desktop contract tests for shared contract consumption, RTL/LTR behavior, combobox/listbox semantics and dense sizing.
- No stock balance, document transaction, transfer workflow, costing, posting or synchronization implementation was introduced in Step 15.

### Step 15 Exit Criteria

Step 15 is complete when:

- Future ERP consumers share one Warehouse selector contract rather than querying codes/titles directly.
- `warehouseId`/`zoneId`/`locationId` remain the only durable selection identities.
- Inactive/archived/tombstoned entities are excluded from normal selector eligibility.
- Company/Branch visibility cannot expose Warehouses from an unrelated Branch.
- Company-context selection without Branch is company-wide-only by default.
- Zone/Location selection remains scoped under a selected Warehouse and returns only active physical nodes.
- A reusable accessible Persian RTL Desktop Warehouse selector is available for future document screens.
- Focused selector contract/UI tests are committed.
- Inventory/Purchase/Sales/Manufacturing transactional integration remains reserved for Step 16 and the later module phases.

### Step 16 — Inventory and ERP Integration Boundaries

Step 16 freezes ownership and dependency direction between Warehouse Master Data and the ERP transaction contexts that consume it.

Completed actions:

- Added `WarehouseOperationalReference` as the canonical downstream persistence reference carrying durable `warehouseId` and optional `zoneId`/`locationId`; code/title/display labels are deliberately absent.
- Added `createWarehouseOperationalReference(...)` validation. A Location reference cannot exist without its Zone context.
- Added `WAREHOUSE_ERP_CONSUMERS` for Inventory, Purchases, Sales, Transfer, Adjustment, Manufacturing, Cost Accounting, Accounting and Taxpayer consumers.
- Added executable `WAREHOUSE_ERP_OWNERSHIP` boundaries instead of relying only on prose architecture notes.
- Warehouse owns Warehouse/Zone/Location master definitions, organizational scope, lifecycle, physical hierarchy and selector/reference eligibility only.
- Inventory owns stock balances, quantities, stock movements, kardex, reservations and stock count.
- Inventory valuation owns cost layers, FIFO/moving-average behavior and valuation.
- Purchases/Sales own their documents, receipt/dispatch workflow and transactional prices.
- Transfer and Adjustment own transaction documents/workflow state; moving a Location master record is explicitly not an inventory-transfer transaction.
- Manufacturing owns material consumption, production output and WIP transactions; Cost Accounting owns production-cost/allocation workflows.
- Accounting owns posting rules, Journal postings and inventory accounting entries. Warehouse does not generate accounting documents.
- Taxpayer owns projection/signing/submission/inquiry. Warehouse does not receive Product's official 13-digit goods/service identifier or Taxpayer unit identity.
- Synchronization/Argin Bridge owns outbox, transport, retries, acknowledgement and conflict resolution; Phase 19 only exposes sync-compatible master-data contracts.
- Reaffirmed Company/Branch visibility from Step 15 as the only supported consumer lookup path; future modules must not bypass it with direct Warehouse table queries.
- Reaffirmed `WarehouseDependencyGuard` as the extension point for future Inventory/Purchase/Sales/Manufacturing blockers before destructive/status/move master-data operations.
- Added forward-only dependency rule: future ERP modules may depend on public `@argin/warehouse` reference/selector/guard contracts; `@argin/warehouse` must not import their transactional models.
- Added `warehouseIntegrationDirection` with reverse dependency explicitly forbidden and mutable display metadata forbidden as foreign identity.
- Added `docs/architecture/warehouse-inventory-erp-integration.md` as the canonical cross-context architecture record.
- Added architecture regression tests covering durable-only operational references, required Zone context for Location, ownership allocation and absence of runtime Warehouse-package dependencies on future ERP transaction packages.
- No stock quantity, movement, receipt/issue/transfer, adjustment, valuation, pricing, posting, manufacturing transaction, Taxpayer transport or live synchronization implementation was introduced.

### Step 16 Exit Criteria

Step 16 is complete when:

- ERP consumers have a durable Warehouse/Zone/Location reference contract that excludes mutable display identity.
- Ownership of stock, movement, valuation, documents, pricing, manufacturing, costing, posting and Taxpayer transport is explicitly outside Warehouse.
- Dependency direction is forward-only from Warehouse Master Data contracts to future consumers.
- Future destructive/status/move protection can be supplied through `WarehouseDependencyGuard` without Warehouse importing future modules.
- Company/Branch selector rules remain the supported consumption path.
- Argin Bridge transport/conflict behavior remains outside Phase 19 implementation.
- Architecture documentation and regression tests lock these boundaries.

All Step 16 implementation artifacts and focused tests are committed. Full executable Domain/Application/Desktop/monorepo validation remains mandatory in Steps 17–19.

### Step 17 — Domain and Application Tests

Step 17 consolidates and strengthens persistence-neutral regression coverage for the complete Warehouse Domain/Application surface before repository/Desktop validation begins.

Completed actions:

- Retained and consolidated existing Domain coverage for Warehouse normalization/immutability, classification/lifecycle, Company/Branch scope, identifiers, Zone/Location hierarchy, maintenance rules, cycle prevention, selector contracts, sync contracts and ERP ownership boundaries.
- Retained Application coverage for create/update/status/scope, restore, physical-structure creation, security/audit, bulk transfer, selector eligibility and integration references.
- Added `warehouse-domain-application-regression.test.ts` as a focused cross-feature Application regression suite.
- Added explicit wrong-Company mutation coverage: a request scoped to another Company receives `not-found` and cannot mutate the owning Company's Warehouse state.
- Added strict optimistic-version-chain coverage across consecutive update, lifecycle and scope mutations, followed by rejection of a stale version.
- Added invalid outer-context coverage proving an empty Company scope is rejected before Unit of Work entry.
- Added Dependency Guard coverage proving a stock/document blocker prevents protected lifecycle mutation, receives durable Company/Warehouse identity and leaves the persisted version unchanged.
- Added idempotency-scope coverage proving the same `requestId` can safely exist in different Company and mutation scopes without replaying an unrelated result.
- Added structural-first dependency coverage proving an active child Location blocks Zone deactivation before an external dependency probe can authorize it.
- Existing restore coverage continues to lock archived-only restoration, stale-version rejection, Company isolation, idempotent replay, preservation of scope/identifiers/createdAt and explicit reactivation after restore-to-inactive.
- Existing physical-maintenance coverage continues to lock edit/status/delete/move semantics, descendant protection and cycle rejection without SQLite dependencies.
- Existing selector tests continue to lock active-only eligibility, Branch visibility and durable reference identity.
- Existing security tests continue to lock authorization-before-mutation and retry-safe Audit behavior.
- No SQLite, migration, Tauri or Desktop assertions were added to this step; those remain Step 18.

### Step 17 Exit Criteria

Step 17 is complete when:

- Core Warehouse business rules are independently testable without SQLite or Desktop composition.
- Company isolation is explicitly covered for mutation paths.
- Optimistic concurrency is covered across a multi-mutation version chain and stale writes are rejected.
- Request idempotency cannot collide across unrelated Company/operation scopes.
- Invalid outer context is rejected before Unit of Work entry.
- Dependency Guard and structural blockers are both covered, including their precedence.
- Restore, selector, maintenance, security/audit, sync and ERP-boundary regressions remain represented in the Domain/Application suite.
- Repository, migration, import/export persistence and Desktop execution remain reserved for Step 18.

All Step 17 test artifacts are committed. These tests were not executed in the assistant environment because the repository cannot be cloned there due DNS/network resolution; executable validation remains required locally and is carried forward into Steps 18–19.

## Change Requests

No Change Request is currently approved for Phase 19.