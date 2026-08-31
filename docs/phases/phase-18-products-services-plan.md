# Phase 18 — Products and Services — Fixed Implementation Plan

## Status

Phase 18 is active. Steps 1–12 are completed; Steps 13–20 are not started.

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
| 6 | Commercial, Tax, and Operational Master Data | Completed |
| 7 | Application, Query, and Repository Contracts | Completed |
| 8 | Application Services, Validation, and Duplicate Detection | Completed |
| 9 | Migration, Schema, Constraints, and Indexing | Completed |
| 10 | Argin Bridge and Future Synchronization Contract | Completed |
| 11 | SQLite Repository, Unit of Work, and Atomic Transactions | Completed |
| 12 | Permissions, Audit, and Approval Integration | Completed |
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

Status: Completed

Evidence:

- Added persistence-neutral `ProductMasterDataProfile` in `packages/product/src/domain/product-master-data.ts` with separate immutable commercial, tax, and operational sections.
- Commercial master data supports normalized brand/model text, purchase/sales descriptions, and stable references to default purchase and sales unit IDs without introducing price lists, invoices, or transaction behavior.
- Tax master data defines explicit `unspecified`, `taxable`, `exempt`, and `not-subject` treatments; taxable records use integer VAT basis points (`0..10000`) so tax-rate configuration remains deterministic and does not depend on floating-point percentages.
- Non-taxable treatments reject a VAT rate, while taxable treatment requires a valid configured rate; this keeps later Purchase/Sales/Taxpayer consumers from inferring tax semantics from unrelated fields.
- Operational master data defines stock-, serial-, lot-, and shelf-life eligibility only. It stores no quantities, balances, movements, valuation, warehouse state, or inventory documents.
- Services are prohibited from stock/serial/lot/shelf-life tracking, and serial/lot/shelf-life configuration requires an explicitly stock-tracked product.
- Defaults are deliberately neutral: no stock tracking, no commercial unit preference, and tax treatment `unspecified`; later workflows must not receive invented transactional defaults.
- Added stable Domain errors for invalid commercial attributes, tax treatment/rate, operational configuration, and service stock-tracking violations.
- Exported the master-data contracts from `@argin/product` and added focused Domain tests covering normalization, VAT invariants, service boundaries, tracking dependencies, immutability, and explicit absence of stock quantities, prices, account IDs, or posting state.
- Persistence, query/repository contracts, Application mutation services, and UI remain deferred to their frozen subsequent steps.

### Step 7 — Application, Query, and Repository Contracts

- Define Commands, Queries, DTOs, readers/repositories, paging, sorting, filtering, lookup, and selector contracts.
- Define Unit of Work and stable Application errors.
- Keep contracts compatible with future SQLite, PostgreSQL, HTTP, and bridge adapters.
- Do not introduce unbounded `findAll()` contracts.

Exit: Product/Service capabilities are consumable without React, Tauri, SQLite, or HTTP dependencies.

Status: Completed

Evidence:

- Added persistence-neutral Product/Service Application contracts under `packages/product/src/application/contracts/` for Commands, Queries, DTOs, Reader, Repository, Unit of Work, stable Application errors, and the aggregate Application facade.
- Mutation commands carry a required `ProductRequestContext` with request, actor, company, and Gregorian occurrence metadata; post-create mutations also require an explicit optimistic `expectedVersion`.
- Added bounded list and selector contracts with explicit page/limit rules; list page size is constrained to `1..200` (default `50`) and selector limit to `1..100` (default `20`). No unbounded `findAll()` repository or reader contract was introduced.
- Added company-scoped filters for search, kind, status, category, purchase/sales eligibility, official Taxpayer goods/service identifier, and stable identifier lookups.
- Added deterministic sorting contracts for code/title/kind/status/created/updated fields and stable list/selector DTOs that expose durable `productId` rather than treating code or title as foreign identity.
- Added `ProductPersistenceState` as a persistence-neutral aggregate persistence envelope containing Product snapshot, identifiers, unit profile, master-data profile, and optimistic version; it contains no SQLite row IDs or adapter-specific types.
- Repository contracts provide only targeted `findById`, `findByCode`, `add`, and optimistic `update`; the Unit of Work contract supplies repositories through an atomic operation boundary without binding Application to SQLite.
- Added stable Product Application error codes for malformed requests/paging/selectors, not-found, code/identifier conflicts, optimistic-concurrency conflicts, and future authorization mapping.
- Exported the complete contract surface from `@argin/product` and added focused contract tests covering bounds, company scope, durable selector identity, optimistic version requirements, Unit of Work behavior, Reader delegation, stable errors, and explicit absence of unbounded query APIs.
- SQLite/PostgreSQL/HTTP/Argin Bridge implementations, duplicate algorithms, mutation orchestration, authorization, audit, and persistence behavior remain deferred to their frozen subsequent steps.

### Step 8 — Application Services, Validation, and Duplicate Detection

- Implement create/update/activate/deactivate and supported master-data mutation use cases.
- Implement duplicate-candidate detection using normalized strong identifiers and justified advisory fields.
- Distinguish hard uniqueness violations from advisory duplicate matches.
- Preserve expected-version and idempotent retry boundaries.

Exit: Application behavior is deterministic, authorization-ready, concurrency-aware, and duplicate-safe.

Status: Completed

Evidence:

- Added persistence-neutral `ProductService` orchestration in `packages/product/src/application/product-service.ts` for create, identity update, identifier replacement, unit replacement, master-data replacement, active/inactive lifecycle mutations, and read delegation.
- All mutation requests validate required request/actor/company identity and normalize Gregorian occurrence timestamps before entering the Unit of Work boundary.
- Create operations validate durable product ID and normalized company-scoped code uniqueness before persistence; post-create mutations reject malformed or stale `expectedVersion` values before repository update.
- Added `ProductDuplicateDetector` contracts with explicit `hard` versus `advisory` strengths and reason codes for code, SKU, reference code, barcode, 13-digit Taxpayer goods/service ID, external identifiers, title, and brand/model candidates.
- Hard code conflicts map deterministically to `product.application.code-conflict`; hard strong-identifier conflicts map to `product.application.duplicate-identifier`. Advisory title/brand-model candidates are surfaced by duplicate checks but do not block valid writes.
- Duplicate probes always carry company scope and, on updates, an excluded durable `productId`, preventing a Product from matching itself while remaining adapter-neutral.
- Added `ProductIdempotencyExecutor` as a persistence-neutral boundary keyed by mutation scope plus `requestId`; retried create/update operations can therefore reuse a SQLite, PostgreSQL, HTTP, or Argin Bridge idempotency adapter without embedding transport logic in Domain/Application.
- Mutations run inside `ProductUnitOfWork`; successful state-changing writes increment optimistic version exactly once, while lifecycle requests that are already in the requested state remain no-ops and do not inflate version or issue a repository update.
- Domain constructors continue to own normalization/invariants for identifiers, unit conversions, tax/commercial/operational master data, and lifecycle timestamps; Application does not duplicate those business rules.
- Added focused Application tests covering advisory duplicate acceptance, hard identifier rejection before persistence, code uniqueness conflicts, idempotent same-request create behavior, stale-version rejection, successful version increments, and lifecycle no-op version stability.
- Authorization and audit enforcement remain owned by frozen Step 12; concrete duplicate-query, idempotency, SQLite repository, and transaction adapters remain owned by frozen Steps 9–11.

### Step 9 — Migration, Schema, Constraints, and Indexing

- Add versioned SQLite migrations for Product/Service persistence.
- Add company-scoped constraints and indexes for durable id, code, barcode, SKU/reference, status, classification, and official identifiers as justified.
- Preserve query-plan viability for large master-data sets.

Exit: schema, constraints, and indexes reflect Domain/Application contracts without embedding business rules exclusively in SQLite.

Status: Completed

Evidence:

- Added versioned desktop SQLite migration `0019_products_services.sql` and registered migration version 19 as `products_services` in the Tauri SQL migration registry.
- Added canonical `products` persistence with durable text identity, explicit company scope, display code/title, product/service kind, active/inactive status, category reference, purchase/sales capability flags, Gregorian timestamps, and optimistic `version`.
- Added normalized child persistence for identifier profile, barcodes, external identifiers, unit definitions, and commercial/tax/operational master data instead of serializing opaque JSON blobs.
- All Product child tables use same-company composite foreign keys back to `products(company_id, id)`, preventing cross-company child attachment at the database boundary while preserving Application ownership of business semantics.
- Added company-scoped hard uniqueness indexes for Product code, SKU, reference code, barcode, 13-digit Taxpayer goods/service identifier, and external scheme/value pairs to mirror Step 8 conflict policy.
- Added deterministic database checks for Product kind/status/boolean/version shape, 13-digit numeric Taxpayer identifier syntax, positive unit ratios, precision `0..6`, supported rounding modes, one base-unit marker, VAT basis-point shape, and operational tracking consistency. Domain/Application remain authoritative for the corresponding business rules.
- Product Units optionally reference the seeded `taxpayer_units(code)` Reference Data from migration 18 with `ON DELETE RESTRICT`; default purchase/sales units use same-product composite foreign keys so arbitrary or cross-product unit IDs cannot be persisted.
- Added query-path indexes for company/status/title, kind/status/title, category/status/title, capabilities/status, updated-time ordering, identifier lookup, barcode/external lookup, product-unit loading, Taxpayer unit lookup, and brand/model advisory duplicate detection.
- Migration DDL was executed against an isolated SQLite database with `PRAGMA foreign_keys=ON` and the required Company/Taxpayer reference dependencies; the schema created successfully. Full upgrade-path, constraint, query-plan, rollback, and Desktop migration tests remain assigned to frozen Steps 18–19.
- No SQLite repository implementation, transaction adapter, synchronization metadata, authorization, audit, inventory balance, valuation, Purchase/Sales document, or posting behavior was introduced in Step 9.

### Step 10 — Argin Bridge and Future Synchronization Contract

- Formalize the durable Product/Service sync-facing contract.
- Define stable identity, version, tombstone/change metadata, external/source references, operation/request identity, and idempotency requirements.
- Document adapter boundaries for future SQLite/Bridge/PostgreSQL/HTTP implementations.
- Do not implement network synchronization or Phase 45 conflict resolution.

Exit: future Argin Bridge integration can be added without redesigning Product/Service identity or core persistence semantics.

Status: Completed

Evidence:

- Added persistence-neutral Product synchronization contracts in `packages/product/src/application/contracts/product-sync.ts`, following the established Phase 17 Party synchronization precedent while preserving Product-specific master-data shape.
- Defined explicit `upsert` and `tombstone` discriminated envelopes. Ordinary Product business status (`active`/`inactive`) remains independent from deletion semantics, so an inactive Product is still synchronized as an upsert rather than being treated as deleted.
- Sync identity uses company-scoped durable `productId`; human-readable `displayCode` is retained only as display/reference metadata and cannot replace durable identity.
- Every envelope carries positive optimistic `version`, `changedAt`, `operationId`, originating `requestId`, `idempotencyKey`, and optional source/external references, enabling retriable future adapters without embedding transport behavior in Domain/Application.
- Upsert envelopes require the snapshot product/company/code to match the durable entity reference; tombstones carry no business snapshot and enforce deterministic deletion/change timestamp ordering.
- External source mappings are normalized and duplicate source-system/external-id pairs are rejected by the contract.
- Added migration `0020_product_sync_metadata.sql`, registered as migration version 20, adding `products.deleted_at`, company-scoped `product_sync_external_references`, change-feed-friendly `(company_id, updated_at, version, id)` indexing, and a dedicated tombstone lookup index.
- Added `docs/architecture/product-sync-contract.md` documenting the adapter boundary for future SQLite, Argin Bridge, .NET/HTTP, PostgreSQL, queued/background adapters, and explicitly excluding URL/HTTP/retry/network state from the canonical Product sync envelope.
- Added focused synchronization contract tests covering durable upsert identity, active/inactive versus tombstone separation, snapshot/reference mismatch rejection, version and operation/request/idempotency validation, external-reference deduplication, timestamp ordering, and absence of transport-specific fields.
- No Argin Bridge network transport, remote acknowledgement, retry/backoff engine, server write path, conflict-resolution strategy/UI, or Phase 45 synchronization engine was implemented in Step 10.

### Step 11 — SQLite Repository, Unit of Work, and Atomic Transactions

- Implement SQLite reader/repository and mapping.
- Implement transaction and Unit of Work boundaries for multi-write operations.
- Enforce expected-version optimistic concurrency and deterministic conflict mapping.
- Implement efficient duplicate/selector/list queries using Step 9 indexes.

Exit: SQLite persistence is atomic, concurrency-safe, bounded, and adapter-compatible.

Status: Completed

Evidence:

- Added a dedicated `@argin/product-tauri` adapter package, following the established `@argin/party` / `@argin/party-tauri` boundary so `@argin/product` remains persistence-neutral and contains no SQLite, Tauri, or plugin-specific imports.
- Implemented `SqliteProductRepository` and the underlying Product SQLite store on the shared `@argin/database` `DatabaseSession` abstraction. Hydration reconstructs Product snapshots, identifier profiles, unit profiles, and commercial/tax/operational master data through existing Domain constructors rather than exposing database rows as domain state.
- Product create/update persistence writes the normalized Product tables from migrations 19–20. Multi-table writes execute through `SqliteProductUnitOfWork`, which delegates to the shared `DatabaseExecutor.transaction` boundary so Product and all child-row writes commit or roll back as one operation.
- Optimistic updates use a company-scoped `UPDATE ... WHERE id = ? AND version = ? AND deleted_at IS NULL`; zero affected rows map deterministically to `product.application.concurrency-conflict` before child rows are rewritten.
- Added deterministic SQLite conflict mapping for company-scoped Product code and strong identifier UNIQUE races so concurrent database conflicts surface as stable `code-conflict` or `duplicate-identifier` Application errors rather than leaking raw SQLite messages.
- Implemented `SqliteProductReader` with company scope, tombstone exclusion, bounded page/selector limits supplied by the Application contracts, deterministic sort-column mapping, and targeted filters for status, kind, category, capabilities, stock tracking, SKU, barcode, and Taxpayer goods/service identifiers.
- Implemented `SqliteProductDuplicateDetector` for hard code/SKU/reference/barcode/Taxpayer/external-identifier checks and advisory title/brand-model checks. Queries exclude the current durable Product on updates, ignore tombstones, remain company-scoped, and are bounded (`LIMIT 20`) while targeting the indexes introduced in Step 9.
- Implemented `SqliteTaxpayerUnitReferenceValidator` against active seeded `taxpayer_units`, preserving the approved Reference Data contract and preventing arbitrary Taxpayer unit mappings from bypassing the Application boundary.
- Added migration `0021_product_idempotency.sql`, registered as migration version 21, with a `(scope, request_id)` primary key and explicit in-progress/completed result semantics. Added `SqliteProductIdempotencyExecutor` so completed retries replay the stored result and concurrent duplicate request identities are rejected deterministically without nesting a second Product transaction around the Unit of Work.
- Added focused `@argin/product-tauri` adapter tests covering transaction-backed Unit of Work behavior, stale optimistic-version conflicts, SQLite UNIQUE-to-Application error mapping, and idempotent completed-result replay. Full real-SQLite migration/repository/rollback/query-plan integration coverage remains assigned to frozen Step 18, and representative performance validation remains assigned to Step 19.
- The assistant runtime could not execute the repository's pnpm test/typecheck/build commands because its direct Git/network environment could not resolve GitHub; this is an agent-runtime limitation, not repository-owner authentication evidence. Local validation commands are therefore required before the next step is accepted.
- No Product desktop UI wiring, permissions/audit/approval behavior, import/export workflow, Argin Bridge transport, or synchronization engine was introduced in Step 11.

### Step 12 — Permissions, Audit, and Approval Integration

- Define granular Product/Service permissions and enforce them at the Application boundary.
- Integrate successful mutations with append-only Audit using actor, company, target, correlation/request ids, time, action, and metadata.
- Evaluate existing Approval architecture and add hooks only where a justified business workflow exists.

Exit: security is not UI-only, successful writes are auditable, and Approval is neither bypassed nor artificially introduced.

Status: Completed

Evidence:

- Added persistence-neutral Product security and audit contracts in `packages/product/src/application/contracts/product-security.ts`, including granular permissions for view/create/update, identifiers, units, commercial/tax/operational master data, lifecycle status, import/export, and Taxpayer reference-data administration.
- Registered the Product/Service permissions in the shared Security `defaultPermissions` catalog under the existing `master-data` module, preserving central role/permission assignment rather than introducing Product-local authorization storage.
- Added optional `correlationId` to `ProductRequestContext` while preserving backward compatibility: when omitted, Product security/audit correlation deterministically falls back to the required `requestId`.
- Added `SecuredProductService` at the Application boundary. Authorization is evaluated before the inner Product mutation executes; authorization failures map to the stable `product.application.unauthorized` error and neither call the mutation service nor emit a success audit fact.
- Create authorization is granular: creation itself requires `master-data.products.create`, while supplied identifiers, units, or commercial/tax/operational master data additionally require their corresponding management permission. Update, identifier, unit, master-data, and status mutations each enforce their dedicated permission.
- Added `SecuredProductReader` so get/list/select operations require `master-data.products.view` in the requested company scope. Duplicate checks are likewise protected by view permission and reject cross-company probe/context mismatches.
- Successful mutations emit append-only `ProductAuditEvent` facts with action, actor, company, durable Product target id, correlation id, request id, Gregorian occurrence time, and bounded metadata. The audit sink contract requires idempotency for `(action, requestId, productId)` so a retried Product request cannot create duplicate audit facts.
- Lifecycle requests that resolve to an Application no-op do not create a new mutation audit fact, preserving audit semantics as facts about effective state changes rather than repeated button presses.
- Added `docs/security/product-security-and-approval.md` as the canonical Product security/audit boundary and explicitly evaluated the existing shared Approval subsystem. No Product approval workflow was introduced because ordinary Product/Service Master Data CRUD has no approved submit/approve/reject business lifecycle; adding one would create artificial state. Any future controlled Product approval requirement must reuse the shared Approval subsystem through an explicit later requirement/Change Request.
- Added focused Product security tests covering permission constants, correlation fallback, authorization-before-write, successful audit emission, denied-write suppression, lifecycle no-op audit suppression, and company-scoped secured reads.
- No UI-only authorization shortcut, Product-specific role store, Product-specific approval engine, inventory/purchase/sales approval behavior, or Taxpayer workflow approval was introduced.
- The assistant runtime still cannot execute repository pnpm commands because direct network/Git resolution is unavailable in the isolated runtime; focused typecheck/test/build commands remain part of local validation before accepting the next step.

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

### CR-18-001 — Versioned Taxpayer Unit Reference Data — Approved

- Approved by the repository owner after Step 5.
- Seed the official Iranian Taxpayer System unit title/code reference data into SQLite as versioned reference data rather than requiring free-form user entry.
- Preserve historical codes by deactivating removed entries instead of destructive deletion.
- Provide a version/diff contract so future application releases or an authorized Reference Data management surface can apply a newer official dataset without redesigning Product Unit identity.
- Keep ordinary Product Unit `unitId`/`code` separate from the external Taxpayer unit code.
- UI management/import/apply behavior remains aligned with the frozen Application/UI steps rather than inserting a new numbered phase step.

Any future change to the frozen sequence or scope must be recorded here before implementation and requires explicit user approval.
