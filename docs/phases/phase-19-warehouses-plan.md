# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–7 are completed. Steps 8–20 are not started.

## Governance

This 20-step sequence is frozen. Step title, order, scope, or exit criteria may change only through an explicitly approved Change Request.

This file is the canonical Phase 19 record. Step status, implementation evidence, validation evidence, Change Requests, and phase exit criteria are maintained here. Cross-cutting rules remain in their canonical architecture/database/security/glossary documents.

Mandatory governance:

- `docs/development/documentation-governance.md`
- `docs/development/github-publishing-workflow.md`

## Objective

Deliver canonical Warehouse Master Data and desktop management with durable identity, company/branch-aware organizational scope, lifecycle, warehouse classification, extensible physical-location boundaries, duplicate-safe identifiers, persistence-neutral Domain/Application contracts, SQLite persistence, authorization/audit, import/export, reusable selectors, and future Argin Bridge compatibility.

Target future direction remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization remains outside Phase 19 and must be implemented only in its dedicated roadmap phase.

## Baseline

Phase 19 starts from `develop` after completion and promotion of Phase 18 — Products and Services.

Phase branch:

`phase/19-warehouses`

Release target:

- Version: `0.19.0`
- Semantic tag: `v0.19.0`
- Release title: `ArginAccounting v0.19.0 — Warehouses`

## Scope

Phase 19 owns reusable Warehouse Master Data and the contracts required by future inventory and ERP consumers. It includes:

- Stable company-scoped Warehouse identity.
- Warehouse code, title, description and lifecycle.
- Warehouse classification and operational metadata.
- Company and branch association rules.
- Extensible physical-location boundary for future Zone/Location/Bin structures without forcing premature stock logic into Warehouse.
- Duplicate detection and identifier normalization.
- Persistence-neutral Domain/Application/Repository contracts.
- SQLite persistence, constraints, indexes and atomic Unit of Work behavior.
- Idempotency and optimistic-concurrency protection for mutations.
- Argin Bridge / future synchronization metadata and tombstone-compatible deletion semantics where required by the existing platform contract.
- Permissions, Audit integration and reuse of existing Approval infrastructure only where a real Warehouse workflow requires it.
- CSV/XLSX import/export.
- Persian RTL desktop management UI following Phase 14 density/accessibility conventions.
- Reusable Warehouse selector contracts for Inventory, Purchasing, Sales, Manufacturing, Cost Accounting and other future consumers.
- Domain/Application/Repository/Migration/Desktop/performance/accessibility/documentation validation.

## Explicit Non-Scope

Phase 19 does not own transactional inventory state or downstream document behavior. The following are explicitly out of scope:

- Product stock balances or on-hand quantities.
- Stock ledger / kardex.
- Warehouse receipt documents.
- Warehouse issue documents.
- Inter-warehouse transfer documents.
- Inventory adjustments and physical stock-count workflows.
- FIFO, weighted-average or other inventory valuation methods.
- Cost layers or inventory costing.
- Inventory accounting postings.
- Purchase documents or purchase pricing.
- Sales documents or sales pricing.
- Manufacturing production/WIP transactions.
- Taxpayer invoice projection, signing, submission or inquiry.
- Live client/server synchronization engine or conflict-resolution UI.

These concerns remain owned by their dedicated roadmap phases. Warehouse must expose durable references and forward-compatible contracts without absorbing their business logic.

## Phase 18 Dependency and Identity Rule

Phase 18 established Product/Service Master Data and durable `productId` references. Phase 19 must consume Product capabilities only through existing public contracts where needed for future integration validation; it must not duplicate Product identity, unit, Taxpayer identifier, commercial/tax attributes or Product lifecycle rules.

Likewise, downstream modules must reference a Warehouse through durable `warehouseId`. Warehouse code, title, branch title, external identifier or UI labels are display/integration metadata and are not foreign identity.

## Argin Bridge Requirement

Argin Bridge compatibility is mandatory from the beginning of the phase.

Warehouse design must remain compatible with the established future topology:

`SQLite <-> Argin Bridge <-> .NET API / PostgreSQL`

Phase 19 must therefore preserve durable IDs, optimistic versioning, deterministic timestamps/metadata, tombstone-compatible deletion semantics where applicable, idempotent mutations, company-scoped identity, and namespaced external identifiers suitable for future integration. Phase 19 must not implement the full synchronization engine.

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
| 8 | Application Services, Validation and Concurrency | Not started |
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

## Step 1 — Completion Record

Step 1 established the authoritative baseline, created `phase/19-warehouses`, froze this plan, recorded the Phase 18 dependency boundary, preserved durable `warehouseId` identity, and made Argin Bridge compatibility explicit while keeping the synchronization engine out of scope.

All Step 1 exit criteria are satisfied.

## Step 2 — Completion Record

Step 2 added independent `@argin/warehouse` Domain package, immutable `WarehouseSnapshot`, durable `warehouseId`, mandatory `companyId`, normalized code/title/description/timestamps, stable Domain error codes, create/rehydrate operations, and focused tests without infrastructure dependencies.

All Step 2 exit criteria are satisfied.

## Step 3 — Completion Record

Step 3 added the frozen Warehouse classifications `general`, `raw-material`, `finished-goods`, `consumables`, `spare-parts`, `wip`, `transit`, `consignment`, and `other`; lifecycle states `active`, `inactive`, `archived`; deterministic activate/deactivate/archive transitions; terminal archive semantics; idempotent same-state requests; timestamp protection; and focused tests.

All Step 3 exit criteria are satisfied.

## Step 4 — Completion Record

Step 4 added explicit organizational scope as company-wide or one Branch, reused the existing Company/Branch model through a minimal Branch reference, enforced same-company ownership and active-Branch assignment, preserved historical inactive-Branch rehydration, prohibited implicit multi-Branch ownership, and blocked organizational reassignment after archive.

All Step 4 exit criteria are satisfied.

## Step 5 — Completion Record

Step 5 added persistence-neutral `WarehouseZoneSnapshot` and `WarehouseLocationSnapshot`, durable `zoneId`/`locationId`, `Warehouse -> Zone -> Location` structure, optional `parentLocationId` for future Rack/Shelf/Bin nesting, typed physical-location kinds and active/inactive master-data status, reference consistency checks, immutable/timestamp-safe rehydration, and focused tests. No stock quantity, movement, costing or inventory document behavior was introduced.

All Step 5 exit criteria are satisfied.

## Step 6 — Completion Record

Step 6 establishes Warehouse code, external-identifier and duplicate-detection policy while keeping persistence and query implementation for later steps.

Completed actions:

- Preserved `warehouseId` as the sole durable foreign identity; code and external identifiers never replace it.
- Added `WarehouseExternalIdentifier` as a namespaced integration identifier with required `namespace` and `value`.
- Added deterministic external-identifier normalization: namespace is trimmed, whitespace-collapsed and uppercased; value is trimmed and whitespace-collapsed without destructive case conversion.
- Added `WarehouseIdentifierSnapshot` and `createWarehouseIdentifierSnapshot` to expose immutable normalized identifier state independently from infrastructure.
- Added `WarehouseDuplicateCandidate` and pure Domain rule `assertWarehouseIdentifiersUnique` so later Application/Repository layers can perform deterministic duplicate validation after loading candidates.
- Warehouse durable IDs are treated as globally unique identities.
- Warehouse `code` uniqueness is company-scoped and compares the canonical normalized uppercase code.
- External identifiers are unique inside a Company by the normalized `(namespace, value)` pair. The same external identifier may exist in another Company without collision.
- Duplicate external identifiers inside the same Warehouse snapshot are rejected.
- Added stable Domain errors for missing external namespace/value, duplicate Warehouse ID, duplicate company-scoped code, and duplicate external identifier.
- Added focused tests for canonical identifier normalization, immutable identifier snapshots, missing namespace/value, duplicate durable ID, same-company code collision, cross-company code reuse, same-company external-identifier collision, and cross-company external-identifier reuse.
- Added no repository lookup, SQL unique constraint, SQLite schema, UI behavior, inventory state, or synchronization engine; those responsibilities remain in Steps 7–11 and later validation gates.

### Step 6 Exit Criteria

Step 6 is complete only when all of the following are true:

- Durable `warehouseId` remains independent from all display/integration identifiers.
- Warehouse code has one deterministic canonical representation and a company-scoped uniqueness rule.
- External identifiers are explicitly namespaced and normalized deterministically.
- Duplicate detection can distinguish durable-ID, code, and external-identifier conflicts with stable Domain errors.
- External-identifier uniqueness is isolated by Company and namespace.
- Identifier snapshots are immutable and persistence-neutral.
- Focused tests cover normalization and duplicate-policy boundaries.
- Persistence/index implementation and actual repository candidate loading are not prematurely implemented.

All Step 6 exit criteria are satisfied by the committed implementation. Full package and monorepo execution validation remains reserved for the later validation gates.

## Step 7 — Completion Record

Step 7 freezes the persistence-neutral Application, Query and Repository boundaries that later Application Service and SQLite implementation steps must consume without redesigning the Warehouse Domain.

Completed actions:

- Added typed Application commands for create/update Warehouse, lifecycle change, organizational-scope change, Zone creation and Location creation.
- Added `WarehouseDto`, list DTOs, Zone/Location DTOs and generic paged-result contract so UI/Application consumers do not depend directly on persistence rows.
- Added bounded Warehouse query contracts with explicit paging and selector limits.
- Added company-scoped list/get/select filters, optional Branch filtering, explicit Company-wide inclusion, classification/status filtering and namespaced external-identifier lookup fields.
- Added Zone and Location query contracts without adding inventory quantities or movement semantics.
- Added `WarehouseReader` as the persistence-neutral read boundary for detail, list, selector, Zone and Location projections.
- Added `WarehousePersistenceState` carrying the organized Warehouse snapshot, normalized external identifiers and optimistic `version`.
- Added `WarehouseRepository` with company-scoped lookup by durable ID, code and namespaced external identifier, plus `add` and version-aware `update(expectedVersion)` contracts.
- Added separate `WarehouseZoneRepository` and `WarehouseLocationRepository` contracts so physical master-data persistence does not contaminate the Warehouse aggregate with stock behavior.
- Added `WarehouseUnitOfWork` / `WarehouseUnitOfWorkContext` covering Warehouse, Zone and Location repositories in one atomic application boundary.
- Re-exported all Step 7 contracts from `@argin/warehouse` public API.
- Added focused contract tests verifying immutable bounded query limits and the company-scoped/version-aware repository signature.
- Added no Application Service orchestration, duplicate lookup workflow, concurrency exception mapping, SQLite implementation, SQL schema, Tauri adapter or live synchronization behavior; those responsibilities remain in Steps 8–11.

### Step 7 Exit Criteria

Step 7 is complete only when all of the following are true:

- Commands, DTOs, queries, Reader, Repository and Unit of Work interfaces are persistence-neutral and exported publicly.
- Every Warehouse read/write lookup is explicitly company-scoped.
- Selector and list query limits are bounded by contract.
- Repository update accepts an `expectedVersion` suitable for optimistic concurrency in Step 8.
- Warehouse, Zone and Location persistence boundaries are explicit without introducing inventory transactions.
- External identifiers can be queried through namespace/value without replacing durable `warehouseId` identity.
- SQLite/Tauri implementation details remain absent from the package contracts.
- Focused tests lock the query-limit and repository-scope contract.

All Step 7 exit criteria are satisfied by the committed implementation. Full Application behavior and concurrency validation are reserved for Step 8 and later validation gates.

## Change Requests

No Change Request is currently approved for Phase 19.
