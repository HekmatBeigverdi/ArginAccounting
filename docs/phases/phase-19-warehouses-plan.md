# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–12 are completed. Steps 13–20 are not started.

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
- Warehouse design must remain compatible with durable IDs, deterministic timestamps, optimistic versions, idempotent mutations, company isolation, future tombstone semantics, origin/source metadata, optional server revision and namespaced external identifiers.

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

Added migration `0022_warehouses.sql`, registered desktop migration version 22, created Warehouse/external-identifier/Zone/Location schema, company/Branch/physical hierarchy foreign keys, hard uniqueness rules, optimistic version constraint, query indexes, and real in-memory SQLite migration/constraint tests. Repository and synchronization implementation remained outside Step 9.

### Step 10 — Argin Bridge and Future Synchronization Contract

Added the persistence-neutral Warehouse sync contract, discriminated upsert/tombstone envelopes, origin/server-revision metadata, sync external references, migration `0023_warehouse_sync_metadata.sql`, version-23 registration, architecture documentation and focused contract/migration tests while keeping live synchronization and conflict resolution out of scope.

### Step 11 — SQLite Repository, Unit of Work and Atomic Transactions

Step 11 implements the production SQLite adapter surface required by the Step 8 `WarehouseService` and the persistence contracts frozen in Step 7.

Completed actions:

- Added dedicated `@argin/warehouse-tauri` adapter package at version `0.19.0`, keeping SQLite/Tauri concerns outside the persistence-neutral `@argin/warehouse` Domain/Application package.
- Added `SqliteWarehouseRepository` with company-scoped lookup by durable id, case-insensitive Warehouse code and namespaced external identifier.
- Repository reads rehydrate persisted state through canonical Domain functions rather than returning raw SQLite rows, including lifecycle, organizational scope, Branch reference and external identifiers.
- Added Warehouse insert/update persistence for the Warehouse row plus external identifiers; normal service writes execute these operations through the Unit of Work transaction boundary.
- Implemented SQL optimistic concurrency with `WHERE company_id = ? AND id = ? AND version = ?` and deterministic zero-row mapping: existing entity means `warehouse.application.concurrency-conflict`, absent entity means `warehouse.application.not-found`.
- Added SQLite unique-conflict mapping to `warehouse.application.duplicate-identifier` while leaving unrelated database failures visible instead of silently misclassifying them.
- Added `SqliteWarehouseZoneRepository` and `SqliteWarehouseLocationRepository` with company/Warehouse/Zone-scoped reads and writes and Domain rehydration of physical master data.
- Added `SqliteWarehouseUnitOfWork`; one `DatabaseExecutor.transaction(...)` supplies the same transactional `DatabaseSession` to Warehouse, Zone and Location repositories so a multi-table mutation either commits or rolls back as one unit.
- Added `SqliteWarehouseReader` implementing detail, list, selector, Zone and Location read contracts with bounded page/selector limits, parameterized filters, controlled sort-column mapping and company-scoped SQL.
- Added `SqliteWarehouseBranchResolver` so Branch-scoped Application validation is backed by the canonical SQLite Branch table without coupling the Domain package to infrastructure.
- Added migration `0024_warehouse_idempotency.sql` and registered desktop migration version `24`.
- Added durable `warehouse_idempotency` storage keyed by `(scope, request_id)` with explicit `in-progress`/`completed` state constraints and stored result JSON.
- Added `SqliteWarehouseIdempotencyExecutor`: completed requests replay the stored result, concurrent in-progress duplicates fail deterministically, successful work stores the result, and failed work releases the claim for a later retry.
- Added focused adapter tests for one-transaction UoW usage, rollback propagation, optimistic-version SQL predicate, stale-version mapping and missing-row mapping.
- Added focused idempotency tests for completed replay, duplicate in-progress detection, successful result persistence and retry after failed work.
- Added real `node:sqlite` migration tests for migration-24 registration, idempotency primary-key enforcement and state-shape checks.
- Kept permission enforcement, Audit emission and Approval policy out of the SQLite adapter; those remain Step 12 responsibilities.
- Added no stock transaction, inventory valuation, purchasing/sales document, Taxpayer submission or live synchronization behavior.

### Step 11 Exit Criteria

Step 11 is complete when:

- Warehouse, Zone and Location persistence contracts have concrete SQLite implementations without leaking SQLite types into Domain/Application contracts.
- `WarehouseService` can be composed with SQLite Repository/Reader/BranchResolver/Idempotency/UoW adapters.
- Multi-repository business writes can execute on one transactional Database session and failure propagates for rollback.
- Warehouse optimistic concurrency is enforced atomically in SQL using `expectedVersion`.
- Missing-row and stale-version failures remain distinguishable.
- Hard SQLite uniqueness conflicts map to the stable Warehouse duplicate error boundary.
- Durable request idempotency survives application retries through SQLite persistence.
- Reader list/select paths remain company-scoped, parameterized and bounded.
- Focused adapter and migration tests cover transaction, concurrency and idempotency behavior.
- Permission/Audit/Approval, import/export, UI and live synchronization remain outside this step.

All Step 11 implementation artifacts and focused tests are committed. Full executable package/desktop/monorepo validation remains mandatory in Steps 17–19. Because `@argin/warehouse-tauri` is a newly introduced workspace package, the generated `pnpm-lock.yaml` importer must be refreshed by pnpm before the later frozen-lockfile validation gate; no dependency versions beyond already-locked workspace/tooling dependencies are introduced by this adapter package.

### Step 12 — Permissions, Audit and Approval Integration

Step 12 adds the authorization and audit boundary around Warehouse Application operations while preserving the generic Approval subsystem as a separate capability that is not artificially activated without a Warehouse domain workflow requirement.

Completed actions:

- Added `warehousePermissions` with stable Inventory-module permission codes for view, create, update, status change, organizational-scope management, physical-location management, import and export.
- Seeded all Warehouse permission definitions in the central Security `defaultPermissions` catalog using Persian titles and the existing `inventory` permission module.
- Added `WarehouseAuthorizationPolicy` and explicit authorization context carrying actor, Company, correlation and request identities.
- Added `SecuredWarehouseService` so authorization is checked before create/update/status/scope/Zone/Location mutations and denied requests cannot reach the underlying Application service.
- Added `SecuredWarehouseReader` so get-by-id, get-by-code, list and selector reads require `inventory.warehouses.view` and remain Company-scoped.
- Added stable `warehouse.application.unauthorized` mapping for infrastructure/security-policy failures without leaking provider-specific errors into Warehouse callers.
- Added Warehouse Audit contracts with explicit action names for create, update, status change, scope change, Zone creation and Location creation.
- Audit events carry actor, Company, durable Warehouse id, optional child entity id, request/correlation identity, normalized occurrence time and immutable metadata.
- Audit persistence is explicitly required to be append-only and idempotent for the same `(action, requestId, warehouseId, childEntityId)` fact so retries cannot duplicate audit history.
- Successful real mutations emit Audit facts; lifecycle/scope Domain no-ops do not emit a false mutation Audit event.
- Authorization always precedes mutation, and failed authorization produces neither a data mutation nor a success Audit fact.
- Added `warehouseApprovalIntegration` with explicit `mode: "not-required"`: Warehouse master-data CRUD/status/scope/location operations do not have an intrinsic approval lifecycle in Phase 19.
- The generic Phase 8 Approval aggregate remains reusable, but binding Warehouse operations to Approval requires a future explicit domain requirement / Change Request rather than being silently introduced by infrastructure.
- Added focused security tests covering permission catalog identity, correlation fallback, explicit Approval boundary, authorization-before-mutation, success Audit emission and denial preventing both mutation and Audit.
- Kept persistent desktop Audit adapter composition, import/export execution, UI permission presentation and any future configurable approval workflow outside this step where their owning phases/steps require them.

### Step 12 Exit Criteria

Step 12 is complete when:

- Stable Warehouse permissions are defined and centrally seeded.
- Read and mutation Application entry points have reusable authorization wrappers.
- Authorization is Company-aware and executes before protected operations.
- Unauthorized infrastructure failures map to a stable Warehouse Application error.
- Successful Warehouse mutations expose append-only, retry-safe Audit facts with durable identity and request correlation.
- No-op lifecycle/scope requests do not generate false mutation Audit facts.
- Warehouse Approval behavior is explicitly defined rather than left ambiguous.
- No Approval workflow is introduced without a concrete Warehouse business requirement.
- Focused tests cover authorization, audit and approval-boundary behavior.
- Import/export implementation, UI wiring and full executable validation remain in their frozen later steps.

All Step 12 implementation artifacts and focused tests are committed. Full executable package/desktop/monorepo validation remains mandatory in Steps 17–19.

## Change Requests

No Change Request is currently approved for Phase 19.
