# Phase 18 — Products and Services — Fixed Implementation Plan

## Status

Phase 18 is active. Steps 1–5 are completed; Steps 6–20 are not started.

## Governance Rule

This plan is frozen for the duration of Phase 18.

Before starting every step:

1. Read this document.
2. Read `docs/development/documentation-governance.md`.
3. Read `docs/development/github-publishing-workflow.md`.
4. Confirm the current branch and latest commit.
5. Confirm the previous step's exit criteria.
6. State the current step number, scope, expected files, and validation commands before implementation.
7. Update only status and evidence sections unless an explicit Change Request is approved.

A step may not be reordered, split, merged, removed, renamed, or materially expanded without explicit user approval. Newly discovered work must be recorded under **Change Requests** and must not silently alter the sequence.

## Phase Objective

Deliver the canonical Master Data model and desktop workflow for Products and Services in ArginAccounting. Phase 18 must provide a persistence-neutral Domain/Application model, product/service classification, lifecycle, units of measure and conversion rules, codes/barcodes/official identifiers, commercial and tax master attributes, duplicate detection, SQLite persistence, authorization and audit integration, bulk import/export, reusable desktop selectors, and forward-compatible synchronization contracts for Argin Bridge and future hybrid deployment.

The phase must prepare a stable master-data boundary for later Warehouse, Inventory, Purchases, Sales, Iranian Taxpayer System, Manufacturing, and Cost Accounting phases without prematurely implementing their business behavior.

## Baseline

- Phase 17 — Parties is completed and merged to `main`.
- `main` baseline at Phase 18 kickoff: `c08e0f976e06621258ceedd71e21e134ce049719` (`merge: release phase 17 parties`).
- Phase 09 provides shared query, Unit of Work, optimistic concurrency, background jobs, notifications, metadata, and shared platform infrastructure.
- Phase 14 provides the canonical Persian RTL desktop design system, compact accounting UI patterns, keyboard/accessibility behavior, and display-density contract.
- Phase 17 establishes the current Master Data integration pattern, stable cross-store identity rules, bounded selectors, and Argin Bridge/future synchronization compatibility.
- Existing Company/Branch, Fiscal, Security, Audit, Approval, Chart of Accounts, Accounting Dimensions, Journal, Lifecycle, Reports, and Party capabilities remain authoritative and must not be duplicated in Phase 18.

## Scope Boundaries

Included: Product/Service aggregate and classification, lifecycle, grouping/category model where justified, units of measure and deterministic conversion rules, internal/display codes, SKU/reference codes, barcodes, official/tax identifiers, commercial/tax/operational master attributes, Application contracts/services, duplicate detection, SQLite schema/repository, atomic writes, optimistic concurrency, permissions/audit integration, future Approval hooks where justified, bulk Excel/CSV import/export, Persian RTL desktop management, reusable Product/Service selectors, integration boundaries for future Warehouse/Inventory/Purchase/Sales/Taxpayer/Manufacturing modules, tests, performance validation, documentation, merge, and release.

Excluded: warehouse master data, inventory quantities/balances, stock movements, inventory documents, inventory valuation, purchase documents, sales documents, automatic accounting posting, posting rules, Taxpayer System invoice submission/signing/inquiry, manufacturing BOM/production logic, cost accounting calculations, full PostgreSQL/Web implementation, active network synchronization, conflict-resolution UI, and the Phase 45 Synchronization engine.

## Argin Bridge and Future Synchronization Contract

Phase 18 does not implement the Argin Bridge transport or synchronization engine. It establishes the minimum durable entity contract required so that future offline/hybrid synchronization can be added without redesigning Product/Service identity or persistence semantics.

The Product/Service design must therefore preserve:

- Stable cross-database identity independent of SQLite row ids.
- Explicit local/display coding separate from durable entity identity.
- Optimistic concurrency/version semantics.
- Durable created/updated metadata suitable for change tracking.
- Soft-delete/tombstone-compatible lifecycle semantics where deletion must propagate later.
- Source/external reference support for imports and future bridge mappings.
- Operation/request identity and idempotent integration boundaries for retriable create/update operations.
- Persistence-neutral Application contracts that can later be implemented by SQLite, PostgreSQL, HTTP, or bridge adapters.
- No network or synchronization business rules embedded in React components or Domain aggregates.

Target future direction remains:

`Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`

Full synchronization remains Phase 45.

## Design Principles

- Product and Service are canonical Master Data concepts; downstream modules reference them rather than redefine them.
- Durable `productId`/entity identity is distinct from human-readable code, SKU, barcode, or official identifiers.
- Domain/Application owns validation and business invariants; React does not.
- SQLite is an adapter, not the source of business rules.
- Company scope and authorization are enforced at the Application boundary.
- Multi-write operations are atomic.
- Internal timestamps remain Gregorian; Persian UI presents Solar Hijri where relevant.
- User-facing surfaces follow the Phase 14 Persian RTL design system and global density contract.
- Stable IDs, versions, and tombstone-compatible lifecycle rules must not depend on a future synchronization implementation.
- Unit conversions must be deterministic, validated, and protected against invalid or ambiguous conversion graphs.
- Import must preview, validate, report duplicates/errors, and avoid partial writes when atomic mode is selected.
- Search and selectors must remain practical for large Master Data sets and avoid loading all Products/Services into memory.
- Product/Service owns definition/master data; later Inventory phases own stock quantity, movement, and valuation.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | Product and Service Domain Model | Completed |
| 3 | Classification, Status, and Lifecycle | Completed |
| 4 | Units of Measure and Conversion Rules | Completed |
| 5 | Codes, Barcodes, and Official Identifiers | Completed |
| 6 | Commercial, Tax, and Operational Master Data | Not started |
| 7 | Application, Query, and Repository Contracts | Not started |
| 8 | Application Services, Validation, and Duplicate Detection | Not started |
| 9 | Migration, Schema, Constraints, and Indexing | Not started |
| 10 | Argin Bridge and Future Synchronization Contract | Not started |
| 11 | SQLite Repository, Unit of Work, and Atomic Transactions | Not started |
| 12 | Permissions, Audit, and Approval Integration | Not started |
| 13 | Bulk Import and Export | Not started |
| 14 | Persian RTL Product/Service Management UI | Not started |
| 15 | Product/Service Selector and Future Module Consumption Contract | Not started |
| 16 | Shared Platform and ERP Integration Boundaries | Not started |
| 17 | Domain and Application Tests | Not started |
| 18 | Repository, Migration, Import/Export, and Desktop Tests | Not started |
| 19 | Monorepo, Performance, Accessibility, Quality, and Documentation | Not started |
| 20 | Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Plan Freeze

- Confirm the completed Phase 17 baseline and current `main` head.
- Create `phase/18-products-services` from the current `main` head.
- Freeze Phase 18 objective, dependencies, scope, exclusions, Argin Bridge constraints, governance rules, and the complete 20-step sequence.
- Establish the Step Status table from kickoff so status never silently drifts from implementation reality.

Exit: the Phase 18 branch and fixed implementation plan exist; no Product/Service business behavior is introduced.

Status: Completed

Evidence:

- Confirmed `main` at `c08e0f976e06621258ceedd71e21e134ce049719` (`merge: release phase 17 parties`).
- Created branch `phase/18-products-services` from that exact SHA.
- Re-read mandatory `docs/development/documentation-governance.md` and `docs/development/github-publishing-workflow.md`.
- Created this fixed plan with all 20 steps, explicit scope boundaries, Phase 14 UI obligations, Phase 09 shared-platform reuse, Phase 17 Master Data integration precedents, and Argin Bridge/future synchronization constraints.
- No Product/Service Domain, Application, persistence, or UI behavior was introduced in Step 1.

### Step 2 — Product and Service Domain Model

- Define the canonical Product/Service aggregate root and durable identity.
- Define product versus service classification without duplicating downstream master data.
- Define core name/title, status baseline, code/display identity, company ownership/scope, and invariant boundaries.
- Keep infrastructure/persistence concerns out of Domain contracts.

Exit: the Product/Service aggregate and primary classification model are explicit and covered by focused Domain tests.

Status: Completed

Evidence:

- Added independent `@argin/product` bounded-context package following the established Master Data package conventions.
- Added persistence-neutral Product/Service aggregate contracts in `packages/product/src/domain/product.ts`.
- Introduced stable `productId` distinct from human-readable `code`, explicit `companyId` scope, normalized title/code, `product`/`service` classification, and an initial `active` status baseline.
- Added deterministic Gregorian `createdAt`/`updatedAt` metadata and rehydration guards without introducing persistence or synchronization transport behavior.
- Added stable Domain error codes for required identity, company scope, display code/title, classification, and timestamp invariants.
- Aggregate snapshots are immutable/frozen and do not contain warehouse, inventory, purchase, sales, accounting-posting, or taxpayer workflow behavior.
- Added focused Domain tests covering product creation, service classification, durable-id/display-code separation, required invariants, invalid classification, immutability, persisted status rehydration, and timestamp ordering.
- Lifecycle transitions, categories/capabilities, units, barcodes/official identifiers, Application services, SQLite persistence, and formal Argin Bridge sync metadata remain intentionally deferred to their frozen later steps.

### Step 3 — Classification, Status, and Lifecycle

- Define category/grouping rules and future-compatible classifications where justified.
- Define active/inactive lifecycle and safe transitions.
- Define capability flags such as purchasable/sellable without leaking Purchase/Sales workflow behavior into Master Data.
- Keep synchronization tombstones distinct from ordinary business activation status.

Exit: classification and lifecycle rules are deterministic and preserve downstream module boundaries.

Status: Completed

Evidence:

- Extended the persistence-neutral Product/Service aggregate with an optional stable `categoryId` reference; category assignment/removal is normalized, immutable, timestamped, and does not embed category persistence or hierarchy queries inside the aggregate.
- Added explicit `ProductCapabilities` with `purchasable` and `sellable` flags. These are Master Data eligibility flags only and do not implement Purchase or Sales workflow behavior.
- Added immutable `activateProduct` and `deactivateProduct` transitions with idempotent no-op behavior when the requested lifecycle state is already current.
- Added immutable `assignProductCategory` and `configureProductCapabilities` transitions with no-op suppression when effective values do not change.
- Mutation timestamps are normalized to Gregorian ISO timestamps and are forbidden from moving backwards relative to the aggregate's current `updatedAt`.
- Product creation defaults to active, purchasable, and sellable while allowing explicit capability configuration for services or specialized items.
- Ordinary business status remains strictly `active`/`inactive`; no `deleted`, tombstone, synchronization, network, or conflict-resolution state was added to the aggregate. Tombstone semantics remain reserved for the frozen Argin Bridge step.
- Added focused Domain regression tests covering category assignment/removal, active/inactive transitions, repeated no-op transitions, capability configuration, service capability scenarios, nested immutability, timestamp ordering, and explicit absence of tombstone/deletion state.
- Units/conversions, barcodes/official identifiers, Application services, SQLite persistence, and formal Argin Bridge metadata remain deferred to their frozen later steps.

### Step 4 — Units of Measure and Conversion Rules

- Define canonical/base unit and alternate units.
- Define deterministic conversion ratios, precision, and rounding semantics.
- Support future purchase/sales/inventory unit consumption without implementing stock behavior.
- Prevent invalid, zero, negative, duplicate, cyclic, or ambiguous conversion semantics as applicable.

Exit: unit definitions and conversions are persistence-neutral, deterministic, and tested.

Status: Completed

Evidence:

- Added persistence-neutral `product-unit.ts` with a canonical base-unit profile and alternate-unit definitions.
- Every alternate unit stores a positive finite `ratioToBase`; the base unit is fixed at ratio `1`, eliminating cyclic and multi-path conversion graphs by construction.
- Unit IDs and normalized unit codes must be unique inside a product unit profile.
- Added explicit quantity precision (`0..6`) and deterministic rounding modes (`half-up`, `down`, `up`) applied at the destination unit boundary.
- Added `convertProductQuantity` which always converts through the canonical base ratio and rejects non-finite quantities or unknown units.
- Added stable Domain error codes for invalid unit definitions, ratios, base ratios, precision, rounding, duplicates, missing units, and invalid quantities.
- Unit profiles, unit collections, and unit definitions are frozen/immutable and contain no stock balance, valuation, warehouse, purchase-document, or sales-document behavior.
- Added focused tests covering base/alternate definitions, carton/package/base conversions, target precision/rounding, ratio and precision rejection, duplicate-code rejection, unknown-unit rejection, and immutable unit profiles.
- Persistence of units and downstream purchase/sales/inventory unit preferences remain deferred to later frozen steps/phases.

### Step 5 — Codes, Barcodes, and Official Identifiers

- Define internal/display code, SKU/reference code, barcode collections, external identifiers, and official goods/service identifiers.
- Define normalization, uniqueness boundaries, and optionality.
- Preserve Taxpayer System compatible master identifiers without implementing taxpayer invoice submission logic.

Exit: identifiers are normalized, deterministic, and safe for downstream lookup and integration.

Status: Completed

Evidence:

- Kept the aggregate's durable `productId` separate from the human-readable internal/display `code`, preserving the Phase 18 identity boundary.
- Added persistence-neutral `ProductIdentifierProfile` support for optional normalized SKU, reference code, multiple barcodes, external identifiers, and the official Iranian Taxpayer System goods/service identifier.
- The Taxpayer System goods/service identifier is validated as exactly 13 numeric digits and remains distinct from Argin `productId`, internal code, SKU, reference code, and barcode values.
- Barcode values are normalized, empty values are rejected, and duplicate barcodes within the identifier profile are rejected deterministically.
- External identifiers use explicit normalized `scheme` plus `value` pairs; duplicate scheme/value pairs are rejected while preserving future ERP/import/bridge mapping flexibility.
- Extended Product Unit definitions with an optional `taxpayerUnitCode` mapping that is explicitly separate from internal `unitId` and unit `code`.
- The taxpayer unit code is treated as an external official-table value: it must be non-empty when supplied, but Phase 18 does not invent a numeric length/format constraint beyond the authoritative Taxpayer System unit-code reference file.
- Added stable Domain error codes for malformed/duplicate barcodes, malformed Taxpayer goods/service IDs, external identifiers, and invalid Taxpayer unit mappings.
- Added focused tests for the 13-digit identifier including `2720000014385`, malformed-length/non-numeric rejection, SKU/reference normalization, barcode/external-id duplicate detection, and Taxpayer unit-code/internal-unit identity separation.
- No Taxpayer invoice projection, signing, submission, inquiry, or network behavior was introduced; those remain owned by Phases 31–35.

### Step 6 — Commercial, Tax, and Operational Master Data

- Model reusable commercial, tax, and operational master attributes required by downstream modules.
- Keep accounting balances, stock balances, valuation, purchase/sales documents, and automatic postings outside the aggregate.
- Keep extensibility aligned with shared metadata infrastructure where appropriate.

Exit: downstream modules can consume stable Product/Service master attributes without owning duplicated definitions.

### Step 7 — Application, Query, and Repository Contracts

- Define Commands, Queries, DTOs, readers/repositories, paging, sorting, filtering, lookup, and selector contracts.
- Define Unit of Work and stable Application errors.
- Keep contracts compatible with future SQLite, PostgreSQL, HTTP, and bridge adapters.
- Do not introduce unbounded `findAll()` contracts.

Exit: Product/Service capabilities are consumable without React, Tauri, SQLite, or HTTP dependencies.

### Step 8 — Application Services, Validation, and Duplicate Detection

- Implement create/update/activate/deactivate and supported master-data mutation use cases.
- Implement duplicate-candidate detection using normalized strong identifiers and justified advisory fields.
- Distinguish hard uniqueness violations from advisory duplicate matches.
- Preserve expected-version and idempotent retry boundaries.

Exit: Application behavior is deterministic, authorization-ready, concurrency-aware, and duplicate-safe.

### Step 9 — Migration, Schema, Constraints, and Indexing

- Add versioned SQLite migrations for Product/Service persistence.
- Add company-scoped constraints and indexes for durable id, code, barcode, SKU/reference, status, classification, and official identifiers as justified.
- Preserve query-plan viability for large master-data sets.

Exit: schema, constraints, and indexes reflect Domain/Application contracts without embedding business rules exclusively in SQLite.

### Step 10 — Argin Bridge and Future Synchronization Contract

- Formalize the durable Product/Service sync-facing contract.
- Define stable identity, version, tombstone/change metadata, external/source references, operation/request identity, and idempotency requirements.
- Document adapter boundaries for future SQLite/Bridge/PostgreSQL/HTTP implementations.
- Do not implement network synchronization or Phase 45 conflict resolution.

Exit: future Argin Bridge integration can be added without redesigning Product/Service identity or core persistence semantics.

### Step 11 — SQLite Repository, Unit of Work, and Atomic Transactions

- Implement SQLite reader/repository and mapping.
- Implement transaction and Unit of Work boundaries for multi-write operations.
- Enforce expected-version optimistic concurrency and deterministic conflict mapping.
- Implement efficient duplicate/selector/list queries using Step 9 indexes.

Exit: SQLite persistence is atomic, concurrency-safe, bounded, and adapter-compatible.

### Step 12 — Permissions, Audit, and Approval Integration

- Define granular Product/Service permissions and enforce them at the Application boundary.
- Integrate successful mutations with append-only Audit using actor, company, target, correlation/request ids, time, action, and metadata.
- Evaluate existing Approval architecture and add hooks only where a justified business workflow exists.

Exit: security is not UI-only, successful writes are auditable, and Approval is neither bypassed nor artificially introduced.

### Step 13 — Bulk Import and Export

- Add CSV/XLSX import preview, mapping, normalization, Domain validation, duplicate diagnostics, and atomic mode.
- Add bounded/streamed export behavior.
- Ensure import cannot bypass Domain/Application invariants or authorization.

Exit: large master-data exchange is safe, diagnosable, and repeatable.

### Step 14 — Persian RTL Product/Service Management UI

- Add the desktop management workspace for list/search/filter/detail/create/edit and supported secondary data.
- Follow Phase 14 Persian RTL design system, compact accounting density, keyboard/accessibility, loading/empty/error/focus/responsive rules.
- Keep business validation in Domain/Application boundaries.

Exit: Product/Service management is usable and consistent with the canonical desktop experience.

### Step 15 — Product/Service Selector and Future Module Consumption Contract

- Provide a reusable bounded Product/Service selector/lookup contract.
- Return stable durable id plus display metadata; never make code/name the foreign identity.
- Support role/capability/status filters required by future Warehouse, Inventory, Purchase, Sales, Taxpayer, Manufacturing, and Cost Accounting consumers.
- Prevent consumers from depending on SQLite or Product UI internals.

Exit: future modules can reference Products/Services through a stable reusable contract.

### Step 16 — Shared Platform and ERP Integration Boundaries

- Verify reuse of Company/Branch, Security, Audit, Metadata, Query, Unit of Work, optimistic concurrency, and other shared platform contracts.
- Define ownership boundaries with Party and future Warehouse/Inventory/Purchase/Sales/Taxpayer modules.
- Ensure Product/Service owns definition/master data while later modules own quantities, movements, documents, balances, valuation, and postings.

Exit: no shared capability is duplicated and downstream ownership boundaries are explicit.

### Step 17 — Domain and Application Tests

- Cover classification, lifecycle, units/conversions, identifiers, master attributes, validation, duplicates, idempotency, concurrency, company isolation, and Application services.
- Include regression coverage for shared contracts touched by the phase.

Exit: core Product/Service business behavior is covered independently of SQLite and Desktop.

### Step 18 — Repository, Migration, Import/Export, and Desktop Tests

- Cover migration upgrade paths, repository mapping, constraints/indexes, rollback, concurrency conflicts, duplicate queries, import/export, selectors, and Desktop integration.
- Cover RTL, density, keyboard/accessibility, and error/loading states where testable.

Exit: persistence and user-facing integration paths are validated end to end within phase scope.

### Step 19 — Monorepo, Performance, Accessibility, Quality, and Documentation

- Execute focused and monorepo validation: tests, typecheck, lint, build, and relevant Desktop/Tauri checks.
- Validate representative large Product/Service datasets and SQLite query plans for list/search/selector/duplicate paths without hardware-specific latency assumptions.
- Validate accessibility, Persian RTL, compact density, and internal documentation links.
- Create/update the canonical Phase 18 guide, ADRs, architecture/database/security/glossary documentation, changelog, roadmap evidence, validation evidence, and release notes as applicable.

Exit: technical validation and mandatory documentation obligations are complete and recorded.

### Step 20 — Final Review, Merge, and Release

- Reconcile Step Status with actual repository state; no stale `Not started` row may remain for completed work.
- Re-run final required validation and review branch scope.
- Promote the phase through the repository's approved branch strategy.
- Prepare semantic release `v0.18.0`, release notes, changelog/roadmap final state, and repository-owner publication actions where required.

Exit: Phase 18 is merged, validated, documented, and prepared/published as the approved semantic release.

## Change Requests

None.

Any future change to the frozen sequence or scope must be recorded here before implementation and requires explicit user approval.
