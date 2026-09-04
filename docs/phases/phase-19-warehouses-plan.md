# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–9 are completed. Steps 10–20 are not started.

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
- SQLite persistence and atomic transactions in later steps
- permissions/audit, import/export, dense Persian RTL UI, selectors and integration boundaries
- Argin Bridge compatibility without implementing the sync engine

## Explicit Non-Scope

Phase 19 does not own:

- stock balances, kardex, receipts/issues/transfers
- adjustments or stock count
- FIFO/average-cost valuation or cost layers
- inventory accounting postings
- purchase/sales pricing or documents
- manufacturing transactional logic
- Taxpayer submission/signing/inquiry
- live synchronization or conflict-resolution UI

## Identity and Argin Bridge Rules

- `warehouseId` is the durable downstream identity.
- Warehouse code, title, Branch title, external identifier and UI labels are not foreign identity.
- Product identity remains owned by Phase 18 and must be consumed through public contracts.
- Warehouse design must remain compatible with durable IDs, deterministic timestamps, optimistic versions, idempotent mutations, company isolation, future tombstone semantics and namespaced external identifiers.

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
| 10 | Argin Bridge and Future Synchronization Contract | Not started |
| 11 | SQLite Repository, Unit of Work and Atomic Transactions | Not started |
| 12 | Permissions, Audit and Approval Integration | Not started |
| 13 | Import / Export and Initial Warehouse Setup | Not started |
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

Added independent `@argin/warehouse` package, immutable `WarehouseSnapshot`, durable `warehouseId`, mandatory `companyId`, normalized code/title/description/timestamps, create/rehydrate operations and focused Domain tests.

### Step 3 — Warehouse Classification, Lifecycle and Business Rules

Added classifications `general`, `raw-material`, `finished-goods`, `consumables`, `spare-parts`, `wip`, `transit`, `consignment`, `other`; lifecycle `active/inactive/archived`; deterministic transitions, terminal archive behavior, idempotent same-state operations and timestamp protection.

### Step 4 — Company, Branch and Organizational Scope

Added discriminated company-wide/Branch scope, same-company Branch validation, active-Branch assignment, historical inactive-Branch rehydration, single-Branch ownership and archived reassignment protection.

### Step 5 — Warehouse Locations and Extensible Physical Structure

Added durable Zone/Location master data, `Warehouse -> Zone -> Location`, optional `parentLocationId`, location kinds for Rack/Shelf/Bin-style expansion and strict Company/Warehouse/Zone reference validation without inventory state.

### Step 6 — Warehouse Codes, Identifiers and Duplicate Rules

Preserved `warehouseId` as primary identity, added normalized company-scoped code uniqueness, namespaced external identifiers and pure duplicate rules for durable ID/code/external identifier conflicts.

### Step 7 — Application, Query and Repository Contracts

Added persistence-neutral commands, DTOs, bounded company-scoped queries, Reader, Warehouse/Zone/Location repositories, version-aware `update(expectedVersion)`, `WarehousePersistenceState`, and atomic Unit of Work contracts.

### Step 8 — Application Services, Validation and Concurrency

Added `WarehouseService`, request-level idempotency contracts, Branch resolution, duplicate checks, stale-version rejection, real-update version increments, Domain no-op preservation, archived physical-mutation protection, nested-location validation and focused Application tests. SQLite/Tauri persistence remains outside Step 8.

### Step 9 — Migration, Schema, Constraints and Indexing

Step 9 establishes the first production SQLite schema for Warehouse Master Data while preserving Repository and transaction implementation for Step 11.

Completed actions:

- Added migration `apps/desktop/src-tauri/migrations/0022_warehouses.sql` and registered it as desktop migration version `22`.
- Added `warehouses` with durable `id`, mandatory `company_id`, normalized display code/title/description, classification, lifecycle, explicit organizational scope, optional Branch reference, UTC timestamps and optimistic `version`.
- Enforced company-scoped, case-insensitive Warehouse code uniqueness with SQLite `NOCASE` semantics.
- Added same-company Branch referential integrity using composite `(company_id, branch_id)` foreign-key semantics; Company-wide Warehouse rows cannot carry a Branch and Branch-scoped rows must carry one.
- Added check constraints for frozen Warehouse classification vocabulary, `active/inactive/archived` lifecycle, valid organizational-scope combinations, non-empty normalized code/title/description, non-regressing timestamps and `version >= 1`.
- Added `warehouse_external_identifiers` with same-company Warehouse FK and unique `(company_id, namespace, value)` boundary; namespace comparison is case-insensitive while value remains case-sensitive, matching Step 6 normalization policy.
- Added `warehouse_zones` with durable identity, same-company Warehouse FK, active/inactive status, Warehouse-scoped code uniqueness and timestamp/text constraints.
- Added `warehouse_locations` with durable identity, Zone/Warehouse/Company composite scope, optional hierarchical `parent_location_id`, typed location-kind checks, active/inactive status, Zone-scoped code uniqueness, self-parent protection and same-scope parent FK.
- Added indexes for company/status/title listing, kind/status filtering, Branch/company organizational filtering, updated-time ordering, external-identifier lookup, Zone lookup, Location lookup and parent traversal.
- Added real `node:sqlite` integration tests that apply migrations `0002` + `0022` in-memory and validate migration registration, company-wide/Branch persistence, case-insensitive code uniqueness, cross-company Branch rejection, scope checks, external-identifier uniqueness, Zone/Location hierarchy integrity, self-parent rejection, classification checks and version checks.
- Added no SQLite Repository implementation, Unit of Work adapter, transaction orchestration, idempotency storage, tombstone/sync metadata or live synchronization behavior; those remain assigned to Steps 10–11 and later validation gates.

### Step 9 Exit Criteria

Step 9 is complete when:

- Migration `0022_warehouses.sql` is registered as version 22.
- Warehouse, external identifier, Zone and Location tables encode the frozen Domain/Application invariants that belong at database level.
- Company/Branch/physical-child scope leakage is blocked by foreign keys and check constraints.
- Warehouse code and external identifier hard-duplicate rules have database-level uniqueness protection.
- Optimistic version state is persisted and constrained.
- Representative list/select/lookup paths have supporting indexes.
- A real in-memory SQLite integration test exercises the migration and critical constraints.
- Repository implementation, atomic Unit of Work behavior, Argin Bridge sync metadata and idempotency storage remain outside this step.

All Step 9 implementation artifacts and focused migration tests are committed. Full executable monorepo validation remains mandatory in the later validation gates.

## Change Requests

No Change Request is currently approved for Phase 19.
