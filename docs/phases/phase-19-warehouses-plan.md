# Phase 19 — Warehouses — Fixed Implementation Plan

## Status

Phase 19 is in progress. Steps 1–10 are completed. Steps 11–20 are not started.

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

Added migration `0022_warehouses.sql`, registered desktop migration version 22, created Warehouse/external-identifier/Zone/Location schema, company/Branch/physical hierarchy foreign keys, hard uniqueness rules, optimistic version constraint, query indexes, and real in-memory SQLite migration/constraint tests. Repository and synchronization implementation remained outside Step 9.

### Step 10 — Argin Bridge and Future Synchronization Contract

Step 10 formalizes Warehouse compatibility with Argin Bridge and the future synchronization phase without implementing transport or conflict resolution.

Completed actions:

- Added `warehouse-sync.ts` as the persistence-neutral synchronization-facing contract exported from `@argin/warehouse`.
- Added discriminated `upsert` / `tombstone` change envelopes for the versioned Warehouse entity.
- Preserved `warehouseId` + `companyId` as durable synchronization identity and kept `displayCode` as metadata only.
- Added required `operationId`, `requestId` and `idempotencyKey` fields so retriable future processing has explicit correlation and deduplication identities.
- Added positive local `version` and optional positive `serverRevision`; `serverRevision = null` is valid before a local record has a known canonical server revision.
- Added explicit origin metadata using `sourceSystem` plus optional `sourceInstanceId` without introducing network/transport state into the Domain.
- Added separate synchronization external references (`sourceSystem`, `externalId`) rather than conflating them with Warehouse business external identifiers from Step 6.
- Added deterministic validation for required operation/request/idempotency fields, durable reference consistency, version/server-revision validity, timestamps, origin, snapshot/reference matching and duplicate source mappings.
- Formalized that Warehouse business lifecycle `active/inactive/archived` remains an `upsert`; `archived` is not a deletion/tombstone signal.
- Added tombstone envelopes with `snapshot: null`, durable identity/version metadata and a validated `deletedAt` timestamp.
- Added migration `0023_warehouse_sync_metadata.sql` and registered desktop migration version `23`.
- Added `warehouses.deleted_at`, `origin_system`, optional `origin_instance_id`, nullable `server_revision`, `warehouse_sync_external_references`, and change-feed/tombstone/server-revision/source-mapping indexes.
- Kept source mappings company-scoped with same-company Warehouse foreign keys and case-insensitive source-system uniqueness semantics.
- Added focused sync-contract tests for immutable upserts, nullable/positive server revision, origin validation, snapshot/reference mismatch, duplicate source mappings, tombstone behavior and archive-vs-tombstone separation.
- Added real `node:sqlite` migration tests for version-23 registration, tombstone/origin/server-revision persistence, company-scoped source mappings and cross-company FK rejection.
- Added `docs/architecture/warehouse-sync-contract.md` as the canonical architecture record for the Step 10 boundary.
- Explicitly excluded change polling, push/pull transport, acknowledgements, retry/backoff, server winner policy, last-write-wins, merge UI, remote writes and network configuration.
- Zone/Location retain durable IDs but are not silently folded into the Warehouse version or sync envelope; independent child synchronization requires a dedicated child change contract when a concrete future consumer needs it.

### Step 10 Exit Criteria

Step 10 is complete when:

- Warehouse durable identity is stable across SQLite, Argin Bridge and future PostgreSQL/.NET projections.
- Upsert and tombstone contracts are explicit, typed and persistence-neutral.
- Idempotency, request/operation correlation, origin metadata, local version and future server revision are represented without transport coupling.
- Archive and tombstone semantics cannot be confused.
- SQLite can persist deletion/origin/server-revision/source-reference metadata without enabling live synchronization.
- External synchronization source mappings cannot cross Company ownership boundaries.
- Focused contract and migration tests cover the new boundary.
- No sync engine, network transport, retry queue or conflict-resolution policy is introduced.

All Step 10 implementation artifacts and focused tests are committed. Full executable monorepo validation remains mandatory in the later validation gates.

## Change Requests

No Change Request is currently approved for Phase 19.
