# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–5 are completed. Steps 6–20 are not started.

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

Likewise, downstream modules must reference a Warehouse through durable `warehouseId`. Warehouse code, title, branch title, external code or UI labels are display/integration metadata and are not foreign identity.

## Argin Bridge Requirement

Argin Bridge compatibility is mandatory from the beginning of the phase.

Warehouse design must remain compatible with the established future topology:

`SQLite <-> Argin Bridge <-> .NET API / PostgreSQL`

Phase 19 must therefore preserve the platform's forward-sync requirements, including durable IDs, optimistic versioning, deterministic timestamps/metadata, tombstone-compatible deletion semantics where applicable, idempotent mutations and company-scoped identity. Phase 19 must not implement the full synchronization engine.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Warehouse Domain Model | Completed |
| 3 | Warehouse Classification, Lifecycle and Business Rules | Completed |
| 4 | Company, Branch and Organizational Scope | Completed |
| 5 | Warehouse Locations and Extensible Physical Structure | Completed |
| 6 | Warehouse Codes, Identifiers and Duplicate Rules | Not started |
| 7 | Application, Query and Repository Contracts | Not started |
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

Step 1 establishes the authoritative Phase 19 baseline and freezes implementation governance before Domain work begins.

Completed actions:

- Verified the Phase 18 completion baseline on both `develop` and `main`.
- Confirmed `develop` and `main` resolve to the same final Phase 18 repository tree before Phase 19 starts.
- Created `phase/19-warehouses` from `develop`.
- Created this canonical Phase 19 plan file.
- Defined Phase 19 objective, Scope and Explicit Non-Scope.
- Preserved the one-canonical-phase-file documentation rule established in Phase 18.
- Froze the 20-step sequence and Step Status table.
- Recorded mandatory Product/Service dependency boundaries from Phase 18.
- Recorded durable `warehouseId` as the downstream identity rule.
- Made Argin Bridge compatibility an explicit Phase 19 requirement while excluding the full synchronization engine.
- Set the semantic release target to `v0.19.0`.

### Step 1 Exit Criteria

Step 1 is complete only when all of the following are true:

- Phase branch exists from the final Phase 18 `develop` baseline.
- Canonical Phase 19 plan exists on the phase branch.
- Scope and Non-Scope are explicit.
- The 20-step sequence is frozen.
- Step 1 is recorded as `Completed` and Steps 2–20 remain `Not started`.
- Argin Bridge compatibility and durable Warehouse identity are documented before Domain implementation starts.
- No stock-balance, stock-movement, valuation, purchasing, sales, Taxpayer submission or live synchronization logic is introduced by Step 1.

All Step 1 exit criteria are satisfied.

## Step 2 — Completion Record

Step 2 establishes the persistence-neutral Warehouse Domain baseline without consuming the responsibilities reserved for Steps 3–6.

Completed actions:

- Added independent `@argin/warehouse` workspace package at version `0.19.0`.
- Added immutable `WarehouseSnapshot` with durable `warehouseId`, mandatory `companyId`, display `code`, `title`, optional normalized `description`, and deterministic UTC timestamps.
- Added `CreateWarehouseInput`, `createWarehouse`, and `rehydrateWarehouse` Domain contracts.
- Added stable Warehouse Domain error codes for required identity/company/code/title invariants and timestamp validation.
- Added canonical normalization: trimmed/collapsed text, uppercase warehouse code, blank optional descriptions normalized to `null`, and ISO UTC timestamp normalization.
- Added rehydration protection against `updatedAt < createdAt`.
- Added focused Domain tests covering durable identity separation, company scope, normalization, immutable snapshots, required invariants, invalid timestamps and rehydration ordering.
- Kept classification/status transitions out of Step 2 for Step 3, Branch association rules out for Step 4, physical structures out for Step 5, and advanced identifier/duplicate rules out for Step 6.
- Introduced no SQLite, Tauri, React, inventory movement, stock balance, valuation, purchasing, sales, Taxpayer submission, or synchronization-engine dependency.

### Step 2 Exit Criteria

Step 2 is complete only when all of the following are true:

- Warehouse exists as an independent persistence-neutral Domain package.
- `warehouseId` is the durable identity and is independent of warehouse display code.
- Company scope is mandatory at the Domain boundary.
- Code/title/timestamps are validated and canonicalized deterministically.
- Domain snapshots are immutable.
- Persisted snapshots can be rehydrated without infrastructure dependencies.
- Focused tests cover the Step 2 invariants.
- No behavior assigned to Steps 3–6 or later phases is prematurely implemented.

All Step 2 exit criteria are satisfied by the committed implementation. Full workspace validation remains part of later phase validation gates; the Step 2 package exposes `test`, `typecheck`, and `build` scripts for local verification.

## Step 3 — Completion Record

Step 3 adds Warehouse classification and lifecycle semantics while preserving the organizational, location, identifier and persistence responsibilities reserved for later steps.

Completed actions:

- Added the frozen Warehouse classification set: `general`, `raw-material`, `finished-goods`, `consumables`, `spare-parts`, `wip`, `transit`, `consignment`, and `other`.
- Added lifecycle states `active`, `inactive`, and terminal `archived`.
- Added `ClassifiedWarehouseSnapshot`, `classifyWarehouse`, and `rehydrateClassifiedWarehouse` without adding infrastructure dependencies.
- New classified Warehouses start as `active`.
- Added explicit `activateWarehouse`, `deactivateWarehouse`, and `archiveWarehouse` Domain transitions.
- Repeated activation/deactivation/archive requests are idempotent when the Warehouse is already in the requested state.
- `archived` is terminal: archived Warehouses cannot be activated or deactivated again.
- Lifecycle mutations preserve immutable snapshots and advance `updatedAt`; timestamp regression is rejected.
- Added stable Domain errors for invalid classification, invalid persisted status, and forbidden transitions from archived state.
- Added focused tests for all supported classifications, invalid classification/status rejection, active/inactive round trips, terminal archive semantics, idempotent same-state transitions, immutability and timestamp-order protection.
- Kept Branch/company organizational association behavior for Step 4, Zone/Location/Bin for Step 5, and external/duplicate identifier rules for Step 6.
- Introduced no stock balance, stock movement, costing, accounting posting, purchasing, sales, Taxpayer submission, SQLite/Tauri persistence or live synchronization logic.

### Step 3 Exit Criteria

Step 3 is complete only when all of the following are true:

- The supported Warehouse classification vocabulary is explicit and typed.
- Lifecycle states are explicit and persisted snapshots can be validated during rehydration.
- New classified Warehouses start active.
- Active and inactive Warehouses can transition deterministically in both directions.
- Archive is a terminal lifecycle state and same-state requests are idempotent.
- Lifecycle transitions cannot move `updatedAt` backwards.
- Domain outputs remain immutable and persistence-neutral.
- Focused tests cover classification and lifecycle invariants.
- Responsibilities belonging to Steps 4–6 and later inventory phases are not introduced.

All Step 3 exit criteria are satisfied by the committed implementation. Full monorepo validation remains reserved for the later validation gates.

## Step 4 — Completion Record

Step 4 defines the organizational ownership boundary for Warehouse while reusing the existing Company/Branch model instead of duplicating Branch master data.

Completed actions:

- Added typed `WarehouseOrganizationalScope` as a discriminated union with exactly two supported modes: company-wide (`company`) or one specific Branch (`branch`).
- Added `OrganizedWarehouseSnapshot` as the next immutable Warehouse Domain layer over the classified/lifecycle snapshot.
- Added a minimal `WarehouseBranchReference` contract containing only Branch durable reference identity, Company ownership, and active/inactive status; Warehouse does not clone Branch code/name/head-office metadata.
- Added `assignWarehouseOrganizationalScope`, `changeWarehouseOrganizationalScope`, and `rehydrateOrganizedWarehouse` Domain operations.
- Enforced that a Branch-scoped Warehouse must reference exactly the requested Branch and that the Branch belongs to the same `companyId` as the Warehouse.
- Enforced that new assignment or reassignment to a Branch requires an active Branch.
- Preserved historical validity during rehydration: a previously valid Branch association remains rehydratable if that Branch later becomes inactive, while cross-company references remain invalid.
- Company-wide Warehouses carry no synthetic Branch identity; Branch scope is optional organizational ownership and does not replace durable `warehouseId` or Company ownership.
- Multi-Branch ownership is intentionally not representable in the Step 4 Domain contract. A Warehouse is either Company-wide or owned by one Branch. Shared multi-Branch semantics require an explicit future Change Request/architecture decision rather than an implicit array of Branch IDs.
- Organizational-scope reassignment is idempotent when the requested scope is unchanged and advances `updatedAt` only on a real scope change.
- Organizational-scope changes reject timestamp regression and are forbidden after the Warehouse reaches terminal `archived` state.
- Added stable Domain errors for invalid organizational scope, missing/mismatched Branch references, cross-company Branch assignment, inactive-Branch assignment, and archived Warehouse reassignment.
- Added focused tests for Company-wide scope, Branch scope, cross-company protection, inactive Branch protection, Branch-reference mismatch, historical inactive-Branch rehydration, idempotent scope changes, timestamp ordering, and archived-state protection.
- Kept Zone/Location/Bin structures for Step 5 and advanced identifier/duplicate rules for Step 6; no stock quantities, movements, valuation, SQLite persistence, UI or live synchronization behavior was introduced.

### Step 4 Exit Criteria

Step 4 is complete only when all of the following are true:

- Every organized Warehouse remains Company-owned and has an explicit organizational-scope mode.
- A Warehouse can be Company-wide or Branch-scoped without changing durable `warehouseId` identity.
- A Branch-scoped Warehouse can reference only one Branch and that Branch must belong to the same Company.
- New Branch assignment cannot target an inactive Branch.
- Historical Branch associations survive later Branch deactivation during rehydration.
- Multi-Branch ownership is not silently introduced.
- Real scope changes advance `updatedAt`, same-scope requests are idempotent, and timestamp regression is rejected.
- Archived Warehouses cannot be organizationally reassigned.
- Domain behavior remains immutable and persistence-neutral.
- Responsibilities reserved for Step 5, Step 6 and later inventory phases remain outside this step.

All Step 4 exit criteria are satisfied by the committed implementation. Full monorepo validation remains reserved for the later validation gates.

## Step 5 — Completion Record

Step 5 establishes an extensible physical-location model for Warehouses without introducing inventory quantity, movement, valuation, or document behavior.

Completed actions:

- Added persistence-neutral `WarehouseZoneSnapshot` and `WarehouseLocationSnapshot` Domain contracts with durable `zoneId` and `locationId` identities independent of display codes.
- Added explicit hierarchy `Warehouse -> Zone -> Location`, while allowing `parentLocationId` on Location so Rack/Shelf/Bin-style nesting can evolve without redesigning Warehouse identity or introducing a rigid fixed-depth tree.
- Added supported physical location kinds: `bin`, `rack`, `shelf`, `staging`, `receiving`, `dispatch`, and `other`.
- Added `WarehousePhysicalStatus` with `active`/`inactive` for persisted physical master data; stock availability semantics are intentionally not inferred from this status.
- Added `WarehouseReference` and `warehouseReferenceFrom` so physical children consume only durable Warehouse/Company identity instead of cloning the Warehouse aggregate.
- Added `createWarehouseZone`, `rehydrateWarehouseZone`, `createWarehouseLocation`, and `rehydrateWarehouseLocation`.
- Enforced Company and Warehouse consistency between Zone, Location and their parent Warehouse reference.
- Enforced Zone-reference consistency during Location rehydration and rejected Location self-parenting.
- Preserved deterministic normalization for codes/text and UTC timestamps, immutable snapshots, timestamp ordering, and historical inactive physical records during rehydration.
- Added stable Domain errors for missing Zone/Location identity, Warehouse/Company physical-reference mismatch, Zone-reference mismatch, invalid physical status, invalid location kind, and self-parenting.
- Added focused tests for Zone creation, nested Rack/Bin-style locations, Company/Warehouse mismatch, invalid kinds, self-parent protection, historical inactive rehydration, timestamp ordering, and mismatched Zone references.
- Did not add stock balances, capacity consumption, reserved quantity, lot/serial tracking, receipt/issue/transfer operations, costing, physical-count workflows, SQLite persistence, UI, or synchronization-engine behavior.
- Kept code uniqueness, external identifiers and duplicate-detection policy for Step 6 rather than embedding repository-level uniqueness into the physical Domain model.

### Step 5 Exit Criteria

Step 5 is complete only when all of the following are true:

- Zone and Location have durable identities independent of display codes.
- Physical children remain bound to the same Company and Warehouse as their parent references.
- Location belongs to a valid Zone and cannot parent itself.
- The model supports future nested physical locations without forcing a fixed Rack/Shelf/Bin depth today.
- Physical snapshots are immutable, persistence-neutral and timestamp-safe.
- Historical inactive Zone/Location records remain rehydratable.
- No stock quantity, movement, valuation, purchasing, sales, accounting posting or live synchronization logic is introduced.
- Duplicate/identifier policy remains reserved for Step 6.

All Step 5 exit criteria are satisfied by the committed implementation. Full package and monorepo execution validation remains reserved for the later validation gates; focused Step 5 tests are included in the `@argin/warehouse` test suite.

## Change Requests

No Change Request is currently approved for Phase 19.
