# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–8 are completed. Steps 9–20 are not started.

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
| 9 | Migration, Schema, Constraints and Indexing | Not started |
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

Step 8 implements the orchestration layer over the frozen Step 7 contracts.

Completed actions:

- Added `WarehouseService` as the persistence-neutral Application Service for Warehouse creation/update, lifecycle changes, organizational-scope changes, Zone creation and Location creation.
- Added read delegation for get-by-id, get-by-code, list and bounded selector queries through `WarehouseReader`.
- Added mandatory `requestId` to all mutation commands so retries can be handled deterministically rather than inferred from mutable business data.
- Added `WarehouseIdempotencyExecutor` contract and wrapped every mutation in an explicit operation/company/entity idempotency scope.
- Added `WarehouseBranchResolver` contract so Application validation can consume Branch identity/status without introducing a direct infrastructure dependency.
- Added stable Application error codes for invalid requests, not-found state, duplicate identifiers, concurrency conflicts, invalid Branch references and forbidden physical mutations after archive.
- Added duplicate validation against Repository lookups before create/update for company-scoped code and namespaced external identifiers.
- Added `expectedVersion` validation and pre-write version comparison; stale mutations fail with `warehouse.application.concurrency-conflict` before Repository update.
- Preserved Repository-level `update(state, expectedVersion)` as the second optimistic-concurrency boundary for SQLite/server implementations.
- New Warehouse state starts at version `1`; successful real updates/lifecycle/scope mutations advance version by one.
- Same-state lifecycle and same-scope Domain no-ops do not write or increment version.
- Warehouse updates rehydrate through Domain canonicalization, preserve immutable snapshots, preserve classification/lifecycle/scope, and reject timestamp regression.
- Branch-scoped creation/scope changes resolve the Branch and rely on Domain rules for same-company and active-Branch enforcement; historical rehydration can preserve an inactive Branch association.
- Zone/Location creation requires an existing Warehouse and rejects physical master-data changes after the Warehouse is archived.
- Location parent validation requires the parent to exist in the same Company, Warehouse and Zone before nested Rack/Shelf/Bin structures can be created.
- Added focused in-memory Application tests for create/idempotent replay, duplicate company-scoped code, stale version rejection, Branch validation, lifecycle versioning, Zone creation and nested Location parent validation.
- Public exports were updated for `WarehouseService`, Application errors, idempotency and Branch resolver contracts.
- No SQLite implementation, schema migration, transaction adapter, Tauri command or live synchronization engine was introduced.

### Step 8 Exit Criteria

Step 8 is complete when:

- Application mutations are orchestrated only through persistence-neutral contracts.
- Every mutation has an explicit idempotency request key.
- Duplicate code/external-identifier validation runs before writes.
- Stale `expectedVersion` values are rejected and Repository optimistic concurrency remains enforceable.
- Real successful mutations advance version exactly once; Domain no-ops do not.
- Branch and physical-parent references are validated before mutation.
- Archived Warehouse restrictions are enforced for later physical master-data creation.
- Focused tests exist for idempotency, duplicate detection, concurrency and key validation paths.
- SQLite/Migration/Tauri work remains outside this step.

Implementation and focused tests are committed. Direct execution of `test/typecheck/build` could not be performed in the assistant container because the environment could not resolve `github.com` during clone; this is an execution-environment DNS limitation, not a repository/authentication issue. Full executable validation remains mandatory in the later validation gates and can be run locally now.

## Change Requests

No Change Request is currently approved for Phase 19.
