# Phase 20 — Inventory Documents — Fixed Implementation Plan

## Status

In Progress. Steps 1–8 are complete; Steps 5–8 have been explicitly owner-accepted. Step 9 implementation and focused contract test definitions are complete; executable workspace validation remains pending. Steps 10–22 are Not started; idempotent/concurrent orchestration, migrations, Argin Bridge envelopes, SQLite integration and Desktop work remain pending.

## Governance

This 22-step sequence is frozen. Titles, order, scope and exit criteria change only through an explicitly approved Change Request. Update Step Status and evidence in this same file after every step; distinguish implemented, actually validated and owner-accepted work. Do not create routine step-status files.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [GitHub Publishing Workflow](../development/github-publishing-workflow.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Contributing](../../CONTRIBUTING.md)

## Overview and Objectives

Deliver the offline quantity-document foundation: receipts, issues, opening quantities, atomic transfers, reasoned quantity adjustments, controlled confirmation/reversal, append-only stock movements, rebuildable on-hand balances and quantity kardex. Preserve future Argin Bridge compatibility from the start.

The canonical [roadmap](../../ROADMAP.md) places Inventory Documents at Phase 20, Inventory Valuation at Phase 21 and Purchase Workflow at Phase 22. Older offline guide numbering must not override this source.

## Baseline and Release Target

- Planning baseline: develop at `3f20840a2617873be7f954db99f4da52ce61b6c7`.
- Phase 19 canonical record marks Steps 1–20 complete and records its merge to develop. This kickoff reconciles stale roadmap/index labels with that record; it does not certify a GitHub Release.
- Branch: `phase/20-inventory-documents`, created from the current develop baseline.
- Target version/tag: `0.20.0` / `v0.20.0`.
- Release title: `ArginAccounting v0.20.0 — Inventory Documents`.
- Tag and GitHub Release publication remain manual owner actions.

## Scope

### Included

- Quantity receipt/issue/opening/transfer/adjustment documents with stable line identities.
- Fiscal and organizational eligibility, numbering, approval, confirmation and linked reversal.
- Exact unit conversion snapshots, stock ledger, on-hand balance projection and quantity kardex.
- Inventory-backed master-data dependency guards.
- SQLite persistence, permission/audit integration, draft import, export, print/PDF and Persian RTL desktop UI.
- Persistence-neutral future-consumer and Argin Bridge change contracts.

### Excluded and Deferred

- Phase 21: FIFO/moving-average valuation, cost layers, landed costs, monetary revaluation and valuation reports.
- Phase 22 onward: Purchase/Sales commercial workflows, invoices, transactional prices and taxes; owning modules consume Inventory confirmation ports.
- Owning posting phases: accounting entries/posting rules. Inventory confirmation is not Journal posting.
- Full stock-count sessions, reservations/available-to-promise, lot/serial/expiry tracking and in-transit two-stage transfers require explicit later planning; no claim of delivery here.
- Phase 45: live Bridge transport, outbox processing, acknowledgement, retries, checkpoints, PostgreSQL/.NET implementation and conflict-resolution UI.
- Taxpayer submission/signing/inquiry and Manufacturing workflows remain outside this phase.

## Architecture

Confirmed planned package boundary (Step 1): `@argin/inventory` for Domain/Application and `@argin/inventory-tauri` for SQLite adapters, registered as planned in the [module registry](../registries/module-registry.md). `@argin/inventory` was created in Step 2; the SQLite adapter remains planned. UI consumes public Application services through Desktop composition.

Reuse Company/Branch, Fiscal, Product units/selectors, Warehouse operational references/selectors, Security, Audit/Approval, Number Series, shared UoW and query infrastructure. Never write another module's tables directly.

References:

- [Warehouse ERP ownership](../architecture/warehouse-inventory-erp-integration.md)
- [Warehouse synchronization](../architecture/warehouse-sync-contract.md)
- [Party Argin Bridge](../architecture/party-argin-bridge-contract.md)
- [Transfer, adjustment and reversal workflows](../architecture/inventory-transfer-adjustment-workflows.md)
- [Inventory Application contracts](../architecture/inventory-application-contracts.md)

### Argin Bridge Rules

Target topology: `Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`.

Document/line/movement/transfer/reversal identities remain stable across stores; display numbers, codes and SQLite row positions are never foreign identity. Company isolation is mandatory. UTC metadata and local optimistic version are distinct from optional server revision. Request replay must not double-decrease stock, even after restart.

Only eligible unconfirmed document deletion may produce a tombstone. Confirmed movements remain immutable and are corrected by linked compensating facts; cancellation, reversal and deletion are different operations. Atomic transfer/reversal grouping and dependency ordering must survive future delivery. Balances are derived locally from accepted movement facts, not an independently editable synchronized stock value. Phase 20 defines contracts and supporting local metadata, not a running synchronization service.

## Domain Model

Implemented at Step 2: InventoryDocumentSnapshot, InventoryDocumentLineSnapshot, InventoryDocumentType, InventorySourceReference and structured InventoryDomainError, with immutable draft factories and validated rehydration. See the [canonical Domain foundation](../architecture/inventory-documents.md).

Implemented at Step 3: InventoryQuantitySnapshot, InventoryUnitSnapshot and InventoryLineOperationSnapshot with exact conversion, current master eligibility checks and historical rehydration.

Implemented at Step 5: the six-state InventoryDocumentStatus contract, explicit transition matrix, immutable lifecycle history, Draft-only edit/delete guards, approval invalidation before correction and confirmed-document reversal linkage.

Implemented at Step 6: `InventoryStockKey`, immutable `InventoryStockMovementSnapshot`, exact signed base-unit arithmetic, deterministic `businessDate -> businessOrder -> durable tie-breakers` chronology, rebuildable `InventoryStockBalanceSnapshot` projections, duplicate-fact guards and default negative-history rejection.

Implemented at Step 7: persistence-neutral receipt/issue/opening confirmation, confirmation-time scope/master/stock revalidation, signed movement generation, durable fiscal-year opening uniqueness keys and lifecycle-bypass protection.

Implemented at Step 8: durable transfer grouping, exact two-sided conservation, intra/inter-Warehouse transfer semantics, signed reasoned adjustments, append-only `reversalOfMovementId` compensation facts and semantic batch atomicity.

Implemented at Step 9: persistence-neutral command/query DTOs, bounded document/kardex/balance readers, typed Application errors, document/movement/balance/opening/business-order/idempotency repository ports, a composed Inventory UoW and future Purchase/Sales/Manufacturing source/confirmation ports.

Still planned in owning steps: durable idempotency/concurrency orchestration, migrations, Argin Bridge envelopes, SQLite transaction atomicity, authorization/Audit integration and Desktop surfaces.

A physical reference includes warehouseId and optional zoneId/locationId under the existing hierarchy contract. Historical references remain resolvable when master data changes. No mutable title/code is identity.

## Application Services

Document create/edit/submit/approve/confirm/cancel/reverse, bounded queries, opening/transfer/adjustment orchestration, quantity ledger/rebuild, draft import/export and future-source confirmation ports. Security, validation, fiscal locks and stock checks are authoritative at the Application/transaction boundary.

Step 9 freezes interfaces only. `requestKey`, payload fingerprints, expected versions, business-order allocation and UoW composition are available as contracts, but replay semantics, fingerprint conflicts, transaction-bound master reads and concurrent stock mutation behavior are implemented in Step 10 and persisted by later steps.

## Data and Migrations

Inventory the actual migration registry before assigning numbers; 0025 is the latest observed migration at planning time. Store exact quantities/conversion data, durable identity, scoped uniqueness, optimistic versions, immutable movement/source links, idempotency fingerprints and synchronization metadata. Multi-write confirmation is atomic. A projection can be rebuilt and reconciled to ledger facts.

## Security and Permissions

Use shared application authorization and approval. Confirm/reverse are separate from edit rights; cross-Branch transfers require access to both ends. Record actor/reason/correlation and lifecycle history. Validate permissions before exposing replayed outcomes or scoped documents.

## User Interface

Persian RTL and Phase 14 density/accessibility; Jalali business dates with Gregorian internal values and UTC system timestamps. Reuse selectors and report/print tooling. Define loading, empty, error, validation, focus, stale-version and responsive behavior. Do not expose implementation-only sync controls.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Inventory Document Domain Model | Completed |
| 3 | Quantity, Units and Operational References | Completed |
| 4 | Company, Branch, Fiscal Scope and Numbering | Completed |
| 5 | Document Lifecycle, Approval and Correction Rules | Completed |
| 6 | Stock Movement Ledger and Balance Rules | Completed |
| 7 | Receipt, Issue and Opening Balance Workflows | Completed |
| 8 | Atomic Transfer and Quantity Adjustment Workflows | Completed |
| 9 | Application, Query and Repository Contracts | Implemented — validation pending |
| 10 | Application Services, Idempotency and Concurrency | Not started |
| 11 | Migration, Schema, Constraints and Indexing | Not started |
| 12 | Argin Bridge and Future Synchronization Contract | Not started |
| 13 | SQLite Repository, Unit of Work and Atomic Confirmation | Not started |
| 14 | Permissions, Audit and Shared Approval Integration | Not started |
| 15 | Master Data Dependency Guards and ERP Integration | Not started |
| 16 | Persian RTL Inventory Document Workspace | Not started |
| 17 | Quantity Kardex, Stock Balances and Source Drill-down | Not started |
| 18 | Import, Export, Print and PDF | Not started |
| 19 | Domain and Application Tests | Not started |
| 20 | SQLite, Migration and Desktop Integration Tests | Not started |
| 21 | Performance, Accessibility, Quality and Documentation | Not started |
| 22 | Final Review, Merge and Release Preparation | Not started |

## Fixed Execution Sequence and Exit Criteria

### Step 1 — Baseline, Branch, Scope and Plan Freeze

Record the current develop baseline, create the phase branch, reconcile Phase 19 status and freeze this numbered plan. Planning does not mark implementation steps complete.

### Step 2 — Inventory Document Domain Model

Define immutable document/header/line identities and receipt, issue, opening, transfer and quantity-adjustment types; separate business date, record timestamp, display number and durable source references.

### Step 3 — Quantity, Units and Operational References

Use exact decimal quantities and Phase 18 conversion rules; snapshot entered/base quantities, unit identity and conversion so later master edits cannot rewrite history. Reject services and ineligible products. Validate Warehouse/Zone/Location durable references.

### Step 4 — Company, Branch, Fiscal Scope and Numbering

Enforce Company isolation, actor Branch access, active fiscal period/date rules and shared Number Series uniqueness. Cross-Company transfers are excluded; explicit cross-Branch transfer policy must authorize both ends.

### Step 5 — Document Lifecycle, Approval and Correction Rules

Define draft, submitted, approved, confirmed, cancelled and reversed transitions with an explicit transition matrix. Only confirmation affects stock; approval alone does not. Reject direct edit/delete of confirmed facts. Draft tombstones and linked reversal are distinct. Editing approval-relevant data invalidates prior approval.

### Step 6 — Stock Movement Ledger and Balance Rules

Define append-only quantity movement facts and rebuildable balances by durable stock key. Default to rejecting negative stock, including effects of backdated operations in deterministic business-date/order sequence. Do not use floating point or mutable balances as the only source of truth.

### Step 7 — Receipt, Issue and Opening Balance Workflows

Define manual quantity receipts/issues, traceable opening quantities and duplicate-opening guards. Revalidate eligibility and stock at confirmation. Opening and imported documents use the same lifecycle; no import bypass may alter stock.

### Step 8 — Atomic Transfer and Quantity Adjustment Workflows

Specify linked source/destination movements with one transfer identity and atomic conservation. Cover intra-Warehouse physical transfer and inter-Warehouse transfer, compatible base units, distinct stock keys and failure rollback. Adjustment requires reason and signed quantity effect. Full stock-count sessions and in-transit/two-stage logistics are deferred.

### Step 9 — Application, Query and Repository Contracts

Define persistence-neutral commands, bounded list/detail/kardex/balance readers, ports, UoW, typed errors and future source-consumer contracts. Product/Warehouse remain upstream public dependencies; no SQL, Tauri or HTTP dependencies in Domain.

### Step 10 — Application Services, Idempotency and Concurrency

Orchestrate validation, numbering, transitions and confirmation. Persist scoped request keys and payload fingerprints; replay returns the original outcome, changed payload conflicts. Compare expected versions and validate balance within the committing transaction, including concurrent issues from different documents.

### Step 11 — Migration, Schema, Constraints and Indexing

Allocate the next unused migration after baseline inventory (latest observed: 0025). Define scoped keys, line/movement/source uniqueness, precision encoding, versions, tombstones, sync metadata, balance projection and durable idempotency; update database dictionary. Released migrations remain immutable.

### Step 12 — Argin Bridge and Future Synchronization Contract

Freeze versioned document and movement envelopes: durable IDs, Company/Branch, operation/request/idempotency IDs, payload fingerprint, local version, optional server revision, UTC change metadata, origin and external references. Transfer/reversal batches cannot be applied partially or twice. Do not merge confirmed movements with last-write-wins or synchronize derived balances as independent authoritative facts.

### Step 13 — SQLite Repository, Unit of Work and Atomic Confirmation

Implement schema and adapters with real SQLite transactions. Commit document version, numbering, movements, balance projection, idempotency and required audit/workflow writes atomically through shared ports. Rollback leaves no partial stock effect. Events are emitted only after commit with replay-safe semantics.

### Step 14 — Permissions, Audit and Shared Approval Integration

Implement separate view/create/edit/submit/approve/confirm/reverse/import/export permissions with Company/Branch enforcement. Integrate Phase 8 approval without inventing a parallel engine. Record actor, reason, source, correlation, before/after and lifecycle history; suppress duplicate success records on replay.

### Step 15 — Master Data Dependency Guards and ERP Integration

Register concrete Inventory probes for Warehouse/Zone/Location maintenance: nonzero stock, open documents and historical movement references; protect delete/deactivate/archive/move semantics as appropriate. Preserve historical references and Product unit history. Supply public quantity-confirmation contracts for future Purchase/Sales/Manufacturing and stable movement feeds for Phase 21.

### Step 16 — Persian RTL Inventory Document Workspace

Build dense Phase 14 list/detail/line editor and selectors with Persian messages, Jalali input/display, explicit LTR codes and exact quantity display. Support lifecycle actions, approval/history, stale-version recovery, keyboard access, field errors and bounded lookup. Iranian Rial conventions apply to any displayed monetary metadata; valuation is excluded.

### Step 17 — Quantity Kardex, Stock Balances and Source Drill-down

Deliver bounded, permission-scoped quantity kardex and balances with opening/in/out/closing reconciliation and document/line drill-down. Explain business-date ordering, same-date tie breaks and backdated effects; distinguish on-hand quantity from future reserved/available-to-promise stock.

### Step 18 — Import, Export, Print and PDF

Provide preview/validation and retry-safe draft import, Excel export, and native print/PDF for documents and quantity reports using shared tooling. Preserve Persian RTL, page orientation, printable pagination, full-screen preview and bottom spacing established in Phase 16. Confirmation remains explicit and authorized.

### Step 19 — Domain and Application Tests

Execute focused tests for lifecycle/approval, exact conversion, scope, negative-stock and backdated rules, opening uniqueness, transfer conservation, reversal links, idempotency conflicts, optimistic races, dependency probes and Bridge contract invariants. Include concurrent issues against the same stock key.

### Step 20 — SQLite, Migration and Desktop Integration Tests

Execute real SQLite migration/upgrade, constraint, atomic rollback, durable retry/restart and balance-rebuild tests; test transfers/reversals as indivisible operations and cross-Company isolation. Exercise import/export, Desktop composition and master-data guard wiring; do not substitute source-text checks for transaction behavior.

### Step 21 — Performance, Accessibility, Quality and Documentation

Validate representative large document/movement data with bounded queries and EXPLAIN QUERY PLAN. Run focused and full monorepo gates plus Rust checks, regenerate documentation index, check links and record actual results. Complete canonical architecture/database/security/glossary/module records and manual Desktop acceptance.

### Step 22 — Final Review, Merge and Release Preparation

Reconcile Step Status with actual evidence and owner acceptance, review deferred scope, and promote through phase -> develop -> main only when finalization is authorized. Prepare v0.20.0; owner creates Tag/GitHub Release manually. No merge or release occurs during planning.

## Consolidated Completion Records

### Step 1 — Baseline, Branch, Scope and Plan Freeze — Completed

- The repository owner requested Step 1 execution after receiving the fixed 22-step plan.
- Verified remote phase head `83346bb6a3d682cd9458db9516a4d8db5c3486f4` and its single parent `3f20840a2617873be7f954db99f4da52ce61b6c7`, which is still the current `develop` head. The branch therefore starts from current develop with exactly the planning commit on top; no baseline merge is needed.
- Reused the existing `phase/20-inventory-documents` branch. The workspace contains no local checkout or pending local project edits; publication uses the authenticated connector and a non-forced ref update based on the inspected remote head.
- Confirmed the Phase 19 completion record and the already-reconciled roadmap/phase-index labels. No assertion about manual tag/release publication is added.
- Confirmed `packages/*` workspace discovery and absence of existing Inventory package directories. Registered `@argin/inventory` and `@argin/inventory-tauri` as planned, without adding empty runtime packages or changing dependencies.
- Confirmed the existing Product exports for units/conversion and selectors, and Warehouse exports for operational references, selectors, dependency guards and synchronization envelopes.
- Inspected the migration file inventory: 25 numbered SQL migrations, ending at `0025_warehouse_maintenance_tombstones.sql`. Migration numbering must be checked again in Step 11; no number is permanently reserved now.
- Reaffirmed the exact scope and all 22 step titles/order/exit criteria without modification. Domain implementation starts in Step 2. Runtime implementation and validation remain pending.
- Updated the phase status, roadmap, phase index, changelog, module registry and module map in this Step 1 checkpoint.

#### Baseline Integration Inventory

| Provider | Observed baseline | Phase 20 consumption |
| --- | --- | --- |
| Product | `@argin/product` exports `convertProductQuantity`, `ProductUnitProfile`, `ProductSelectorService` | Exact quantity conversion, history snapshots and inventory eligibility in Steps 3/9/16; inspect concrete precision/rounding behavior before implementation |
| Warehouse | `WarehouseOperationalReference`, `createWarehouseOperationalReference`, Company/Branch-aware selectors | Durable warehouse/zone/location references in Steps 3/4/9/16; location requires zone |
| Warehouse maintenance | Public `WarehouseDependencyGuard`; unintegrated fallback is still exported | Wire real Inventory blockers in Step 15 and test Desktop composition in Step 20 |
| Shared platform | Company, Fiscal, Security, Audit/Approval, Platform and Database packages exist | Reuse published ports for scope, numbering, authorization, approval and transactions; concrete composition in owning steps |
| Synchronization preparation | Product and Warehouse upsert/tombstone public contracts exist | Preserve durable IDs and metadata; freeze Inventory transaction-aware Bridge contract in Step 12 |
| Persistence/runtime | `packages/*` workspace pattern; migrations 0001–0025; `validate:phase19` exists | Introduce Inventory runtime pieces in their owning steps; `validate:phase20` is still planned for Step 21 |

These are source/baseline inspections, not claims of executed runtime integration tests. Existing contract presence does not mean Inventory dependency guards or stock operations are already wired.

#### Step 1 Validation and Handoff

- Checked remote head/parent ancestry against current develop.
- Checked that the fixed execution sequence and exit-criteria text are unchanged.
- Checked Step Status contains exactly one Completed row (Step 1) and 21 Not started rows.
- Checked relative Markdown links in this checkpoint against the repository tree.
- Existing documentation paths and H1 titles are unchanged, so generated index entries do not change.
- No production code, migration, lockfile or package manifest changes are part of this step. Application tests/builds and manual Desktop acceptance were not run.
- Next executable step: Step 2 — Inventory Document Domain Model.

### Step 2 — Inventory Document Domain Model — Completed

- Added `@argin/inventory` version `0.20.0` as an independent strict TypeScript package with public Domain exports, package scripts and a workspace lockfile importer reusing existing resolved development dependencies.
- Added immutable draft document/header and owned line snapshots with separate durable IDs, display number and positive display positions. Duplicate normalized line IDs and positions are rejected; repeated Product IDs on distinct lines are valid.
- Added all five fixed document types: receipt, issue, opening, transfer and adjustment. Factories create structural drafts at version 1; no stock effect, Number Series allocation or lifecycle action is implied.
- Added real Gregorian business-date validation and explicit UTC recording timestamps with canonical millisecond serialization and chronological rehydration checks. Business dates remain independent from recording dates.
- Added durable Company/source-system/document-type/document/optional-line source references; cross-Company header/line sources and self-sourcing within the Inventory namespace are rejected.
- Added defensive copy/freeze for every owned object and collection, safe persisted draft rehydration, stable error codes and field identifiers. Domain reads neither the system clock nor random IDs and imports no runtime dependency.
- Added 20 Domain tests covering identity/order separation, all types, duplicate lines, source isolation, calendar edges, invalid timestamps/versions/statuses, nested immutability, malformed runtime inputs and serialized round trips.
- Added canonical architecture documentation and glossary terms; updated module registry/map, roadmap, phase index and changelog. Generated the documentation index with the repository script.
- No migration, permission catalog, event, Application service, SQLite adapter or Desktop screen was changed. Quantity/UoM/physical references remain Step 3, fiscal rules Step 4, lifecycle Step 5, and later stock operations retain their existing step numbers.

#### Step 2 Validation Evidence

Environment: Node `v24.19.0`, available pnpm `11.19.0`, TypeScript `5.9.3`. The repository packageManager field remains unchanged at pnpm `12.3.4`; this checkpoint does not claim a run with that pinned manager version.

| Executed command/check | Result |
| --- | --- |
| `pnpm --filter @argin/inventory install --frozen-lockfile --ignore-scripts` | Passed; existing dependency resolutions reused |
| `pnpm --filter @argin/inventory test` | Passed: 20 tests, 0 failures |
| `pnpm --filter @argin/inventory typecheck` | Passed |
| `pnpm --filter @argin/inventory build` | Passed (`tsc --noEmit`, matching adjacent Domain package convention) |
| `node scripts/generate-doc-index.mjs` | Generated canonical index |
| Changed-document relative links, unchanged fixed sequence, Step Status counts and `git diff --check` | Checked for this checkpoint |

Full monorepo/Rust/Desktop gates were not run for this isolated, unconsumed Domain package; they remain required in the later quality steps. The 20 tests do not certify quantity, stock, approval, idempotency or persistence behaviors that are not yet implemented.

#### Step 3 Handoff

- Preserve the delivered document/line/source identities when adding exact quantities, unit snapshots and physical references.
- Inspect the existing Product unit implementation carefully: `convertProductQuantity` and `ratioToBase` currently use JavaScript `number`. Adapt the precision boundary explicitly before exact Inventory stock calculations; do not silently inherit floating-point arithmetic.
- Product ownership/existence/eligibility and Warehouse hierarchy eligibility remain upstream contract checks; Step 2 only validates structural identity and source Company consistency.
- Frozen step titles, order, scope and exit criteria are unchanged. Next executable step: Step 3 — Quantity, Units and Operational References.

### Step 3 — Quantity, Units and Operational References — Completed

- Started from remote `e5dd3d5e8da112ac88ec4d8bd09d3438e049b66b`, preserving the owner's Step 2 documentation/dictionary corrections.
- Added canonical decimal-string quantities and conversion with BigInt coefficient arithmetic. Stock quantities do not pass through JavaScript floating-point multiplication. Inputs/outputs are bounded and JSON-safe; selected-unit precision and Phase 18 signed rounding semantics are enforced.
- Adapted public Product unit profiles by preserving their numeric ratio's decimal spelling, expanding supported exponents and rejecting unsafe/out-of-range ratios. Product module code and existing unit identities are unchanged.
- Added immutable snapshots of entered/base quantities and both units' IDs, labels, codes, ratio, precision, rounding mode and Taxpayer unit mapping. Rehydration verifies stored arithmetic without reading current units, so later unit edits/removal cannot rewrite document meaning.
- Added current Product validation for durable ID/Company, active physical stock-tracked status, unit profile and positive version. Services, deleted/inactive/non-stock products and deferred serial/lot/shelf-life tracking requirements are rejected explicitly.
- Added requested-versus-resolved Warehouse/Zone/Location validation for Company, identity, active/non-deleted state and ancestry using the public Warehouse reference contract. Missing/mismatched parents or unexpected children fail; Location requires Zone.
- Added source and optional destination references to immutable line operation snapshots, with same-Company and distinct-position validation. Draft composition rejects Company/Product mismatches, inappropriate negative quantities and destination/type mismatches. Transfer execution remains Step 8.
- Preserved incomplete drafts with `operation: null`; supplied operations are fully structurally validated. Historical rehydration does not establish current master eligibility or permission to confirm; future Application services must resolve/recheck actual masters within transaction boundaries.
- Extracted the shared Domain error catalog into `inventory-errors.ts` without changing existing public error exports. Added only forward public dependencies on Product and Warehouse and corresponding workspace lockfile links.
- Updated canonical Inventory architecture, ADR-0018, decision/module registries, glossary, roadmap, phase index and changelog; retained the fixed 22-step sequence.

#### Step 3 Validation Evidence

Environment: Node `v24.19.0`, available pnpm `11.19.0`, TypeScript `5.9.3`. The pinned repository manager remains unchanged at `12.3.4`.

| Executed command/check | Result |
| --- | --- |
| `pnpm --filter @argin/inventory install --frozen-lockfile --ignore-scripts` | Passed with workspace Product/Warehouse links; no dependency resolution changes |
| `pnpm --filter @argin/inventory test` | Passed: 44 tests, 0 failures (20 prior + 24 Step 3 tests) |
| `pnpm --filter @argin/inventory typecheck` | Passed |
| `pnpm --filter @argin/inventory build` | Passed |
| `node scripts/generate-doc-index.mjs` | Regenerated canonical index |
| Frozen sequence, Step Status, changed-document relative links and `git diff --check` | Checked for this checkpoint |

An initial 42-test run had one test expecting a unit-mismatch error while its fixture first triggered the legitimate precision error. The fixture was narrowed to test unit-metadata mismatch independently; no production invariant was relaxed. Two additional integration/defensive-copy cases bring the final suite to 44 passing tests.

Coverage includes exact values above the number safe-integer range, `0.1 × 0.2`, all rounding modes for both signs, zero/underflow/overflow, legacy exponent ratios, invalid profiles, unit-history serialization/drift, real public Product/Warehouse factories, ineligible masters, hierarchy isolation, historical reads, transfer reference shape and document composition.

No migration, permission, stock ledger, SQLite service or Desktop UI was added. Full monorepo/Rust/manual Desktop gates were not run; focused public-master integration cases are part of the passing Inventory suite.

#### Step 4 Handoff

Keep stored unit/quantity snapshots stable. Add Company/Branch/fiscal eligibility and numbering through shared contracts. Current master projections must originate from actual scoped readers and be revalidated by authoritative mutation services; supplied or rehydrated snapshots are not authorization. Step 3 defines reference/quantity invariants, not stock confirmation or transfer execution.

### Step 4 — Company, Branch, Fiscal Scope and Numbering — Completed

- Preserved the owner's Step 3 corrections at `3f1a30cad63c43c135a5a2044f7efc9cc0cf2e2f`; owner accepted Step 3 before this work. Step 4 implementation/validation is complete; owner acceptance remains separate.
- Added immutable optional draft scope with origin/destination Branch and fiscal year/period identities. Current eligibility requires scope; historical draft reads remain independent from current masters. Wildcard scope IDs are rejected to avoid collisions with shared Number Series missing-scope keys.
- Added current Company/Branch/Fiscal/Warehouse validation through public upstream readers. Trusted authenticated Company must match; Company and both transfer branches must be active and Company-owned. Actor membership is checked at both ends. Cross-Branch transfer is disabled unless trusted policy explicitly enables it; cross-Company transfer remains excluded.
- Enforced open Company-owned year and nested open period, valid inclusive Gregorian date ranges, year closure marker, and Company-wide or applicable Branch inventory/all historical locks. Full-access permission bypasses Branch membership only.
- Rechecked populated line Warehouse endpoints against current scoped readers and the shared Warehouse Branch visibility policy. Incomplete drafts are retained; confirmation completeness remains a lifecycle/service responsibility.
- Added five default series definitions and reservation through shared Platform Number Series. Company/year/origin Branch/document type define the counter; period and destination Branch do not restart it. Allocation follows validation, rejects already-numbered inputs and validates provider output without mutating the document.
- Added public Company/Fiscal/Security/Platform dependencies using existing workspace links. No private upstream imports, database counter implementation, migrations or permission catalog changes.
- Preserved Argin Bridge identity/snapshot boundaries: display numbers are not durable document IDs. Future authoritative services must resolve trusted context, revalidate masters, enforce durable uniqueness and reserve/save within the same UoW after idempotency lookup. No persistence, retries, stock posting or live Bridge endpoint is claimed here.

#### Step 4 Validation Evidence

Environment: Node `v24.19.0`, available pnpm `11.19.0`, TypeScript `5.9.3`. Repository pnpm pin remains `12.3.4`; that version was not used here.

| Executed command/check | Result |
| --- | --- |
| `pnpm --filter @argin/inventory install --frozen-lockfile --ignore-scripts` | Passed; reused resolved dependencies and workspace links |
| `pnpm --filter @argin/inventory test` | Passed: 72 tests, 0 failures (44 prior + 28 Step 4) |
| `pnpm --filter @argin/inventory typecheck` | Passed |
| `pnpm --filter @argin/inventory build` | Passed |
| `node scripts/generate-doc-index.mjs` | Regenerated canonical index |
| Fixed sequence, Step Status, changed-document relative links and `git diff --check` | Checked for this checkpoint |

Coverage includes scope immutability/wildcards, Company isolation, actor access at both transfer ends, explicit cross-Branch policy, fiscal status/date/ownership, inclusive historical locks, live Warehouse eligibility, 50 concurrent unique reservations with the public in-memory Platform store, numbering partition boundaries and malformed allocator output. The first Warehouse test fixture lacked required DTO version/external identifiers; completing the fixture resolved typecheck without weakening production contracts.

Concurrent in-memory allocation does not certify durable SQLite uniqueness or transaction rollback. SQLite/full monorepo/Rust/manual Desktop gates remain in their fixed owning steps. There is no new UI in this checkpoint.

#### Step 5 Handoff

Next: Step 5 — preserve the frozen lifecycle step below. Compose these scope checks with current Product/physical-reference checks and transaction-bound readers in later authoritative services. Number reservation alone does not authorize confirmation or guarantee retry idempotency; failed commits require shared UoW rollback. Existing unit snapshots and durable IDs must remain stable.

### Step 5 — Document Lifecycle, Approval and Correction Rules — Completed

- Reconciled implementation against the frozen Step 5 text before closure. The canonical six-state vocabulary is `draft`, `submitted`, `approved`, `confirmed`, `cancelled`, `reversed`; an earlier intermediate three-state implementation was replaced before this checkpoint and is not the accepted contract.
- Added/exported `INVENTORY_DOCUMENT_TRANSITIONS` with explicit legal edges: Draft submit/cancel; Submitted return/approve/cancel; Approved return/confirm/cancel; Confirmed reverse; Cancelled/Reversed terminal.
- Added immutable `InventoryLifecycleTransitionSnapshot` history to the aggregate. Every transition records from/to state, actor, UTC timestamp, optional reason and only-for-reversal related document ID; successful transitions increment local version and advance `updatedAt` monotonically. Rehydration validates the complete transition chain and rejects forged status/history combinations.
- Submission requires current structural completeness: scope, display number, at least one line and an operation snapshot on every line. This is a Domain completeness gate only; current master/fiscal/security revalidation remains an authoritative Application/UoW responsibility.
- Kept Approval and Confirmation separate. `approveInventoryDocument` only permits `submitted -> approved`; `confirmInventoryDocument` only permits `approved -> confirmed`. Step 5 creates no movement or balance writes, so approval has no stock effect and confirmation is only the lifecycle gate consumed by later stock-transaction steps.
- Ordinary mutation is Draft-only. Submitted documents can explicitly return to Draft. Approved documents require an explicit reason for `approved -> draft`; this invalidates the current approval before approval-relevant data can be edited, forcing a new submit/approve path before confirmation.
- Added a distinct Draft-only deletion guard. Cancellation is a retained terminal lifecycle fact and does not represent deletion or a synchronization tombstone. Confirmed documents cannot be cancelled or directly edited/deleted.
- Added linked reversal semantics: only a Confirmed original may become Reversed, with a non-empty reason and a distinct durable `reversalDocumentId`. Step 5 does not create inverse stock movements; compensating movement creation, negative-stock/fiscal checks, idempotency and atomic UoW behavior remain in Steps 6–13.
- Preserved Argin Bridge preparation: lifecycle version/history and reversal links use durable identities and UTC metadata, while display numbers and SQLite positions remain non-identities. This does not claim the Step 12 synchronization envelope or live transport.
- Updated the canonical Inventory architecture document and public package exports. No migration, persistence adapter, permission catalog, shared Audit/Approval composition, event or Desktop UI was added; those remain in their frozen owning steps.
- Reworked focused lifecycle tests to cover the six-state matrix, completeness, approval/confirmation separation, approval invalidation, Draft deletion versus cancellation, confirmed reversal linkage, terminal immutability, monotonic timestamps and persisted-history tamper rejection. Existing document regression tests were aligned with lifecycle history while retaining Step 2 structural assertions.
- The repository owner explicitly accepted Step 5 in chat before requesting Step 6. Raw local command output was not pasted into the conversation; acceptance and executable evidence remain distinct facts.

#### Step 5 Validation Evidence

| Check | Result |
| --- | --- |
| Frozen Step 5 wording vs implementation | Reconciled; all six required states and required distinctions are represented |
| Public exports and old Step 2 document tests | Updated to the six-state/history contract |
| Focused lifecycle tests | Added/rewritten in `packages/inventory/tests/inventory-lifecycle.test.ts`; execution was not observed by the assistant environment |
| GitHub Check Runs during Step 5 checkpoint | No check runs were configured/reported |
| Owner acceptance | Explicitly accepted in chat before Step 6 |

Step 5 is therefore closed by owner acceptance while retaining truthful validation provenance.

#### Step 6 Handoff

Step 6 consumes only the Confirmed lifecycle gate to define append-only StockMovement facts and rebuildable balances. Approval remains non-stock-effective. Confirmed history is never deleted or rewritten; later reversal produces compensating facts linked through the separate reversal document identity.

### Step 6 — Stock Movement Ledger and Balance Rules — Completed

- Added/exported `InventoryStockKey` using durable Company + Product + Warehouse + optional Zone + optional Location identity. Warehouse-only, Zone-level and Location-level stock positions remain distinct; mutable display codes/titles and database row positions are excluded from identity.
- Added immutable `InventoryStockMovementSnapshot` facts with durable `movementId`, source document/line IDs, `businessDate`, positive stable `businessOrder`, UTC `recordedAt`, StockKey and signed Product-base-unit `quantityDelta`.
- Added defensive movement rehydration that revalidates Company/StockKey structure, canonical quantity/date/time/order values and rejects tampered hierarchy or Company identity.
- Added exact stock addition with canonical decimal strings and BigInt coefficient arithmetic. Values such as `0.1 + 0.2` and quantities above JavaScript's safe-integer range are not processed with floating point.
- Added deterministic chronology: `businessDate -> businessOrder -> documentId -> lineId -> movementId`. `businessOrder` is the explicit same-day business ordering fact; later authoritative confirmation/UoW code owns durable allocation/persistence. UUID lexical order, SQLite rowid, local arrival order and `recordedAt` are not treated as business chronology.
- Added `rebuildInventoryStockLedger` to derive balances from immutable movements only. It rehydrates/sorts all facts, rejects duplicate movement IDs and duplicate source-line facts for the same StockKey, and emits frozen balance projections.
- Default negative-stock policy validates the running quantity at every historical position. A backdated candidate is rejected when it would make any historical StockKey balance negative even if a later receipt would make the final ending balance positive. Same-date `businessOrder` participates in the same rule.
- Added explicit `allowNegativeStock: true` policy support for deployments that intentionally permit negative inventory; permissive mode does not alter fact identity, chronology or rebuild rules.
- Added functional `appendInventoryStockMovement`: candidate insertion rebuilds chronology and never mutates the caller ledger. Rejected duplicate/backdated/negative candidates therefore leave the original snapshot intact.
- Added derived zero-balance lookup for StockKeys with no movement facts, avoiding invention of a mutable authoritative balance record.
- Preserved Step 7/8 boundaries: generic movement facts do not decide receipt/issue/opening signs, opening uniqueness, transfer source/destination conservation, adjustment reason/effect or reversal compensation generation.
- Preserved Step 10–13 boundaries: no SQLite schema, durable `businessOrder` allocator, transaction lock, idempotency persistence, confirmation UoW or balance cache table is implemented here.
- Added 17 focused Step 6 test definitions covering StockKey hierarchy/isolation, immutable movement round-trip, invalid order/date/time/zero, exact decimal arithmetic, rebuild-only balances, input-order independence, same-day business ordering, current/backdated negative-stock rejection, permissive policy, key isolation, zero projection, duplicate fact protection, transfer-compatible distinct StockKeys and tamper rejection.
- Added [ADR-0019](../adr/ADR-0019-inventory-stock-ledger.md) and updated the canonical Inventory architecture record.
- The repository owner explicitly accepted Step 6 in chat before requesting Step 7. Raw local command output was not pasted into the conversation; owner acceptance and executable evidence remain distinct facts.

#### Step 6 Validation Evidence

| Check | Result |
| --- | --- |
| Frozen Step 6 wording vs implementation | Reconciled: append-only facts, rebuildable balances, deterministic business-date/order chronology, default negative-history rejection and no floating point are represented |
| Focused Step 6 test definitions | Added in `packages/inventory/tests/inventory-stock.test.ts`; 17 tests defined |
| Static defensive review | Corrected same-day ordering to use explicit `businessOrder` rather than accidental UUID/document ordering; corrected sparse-array rehydration path and deterministic StockKey sort |
| Assistant execution environment | Node `v22.16.0` and TypeScript `5.8.3` are present, but no complete repository checkout/workspace is available, so the real package test/typecheck/build is not claimed |
| GitHub branch CI | Branch protection reports no required checks; no successful Step 6 workspace run is claimed |
| Owner acceptance | Explicitly accepted in chat before Step 7 |

Step 6 is closed by owner acceptance while retaining truthful validation provenance.

#### Step 7 Handoff

Step 7 consumes the approved lifecycle state, Step 4 current scope validation and Step 6 ledger rules to make receipt/issue/opening confirmation semantics explicit. Transfer, adjustment and reversal movement generation remain Step 8.

### Step 7 — Receipt, Issue and Opening Balance Workflows — Completed

- Added/exported `confirmInventoryReceiptIssueOpening` as a persistence-neutral Application workflow for only `receipt`, `issue` and `opening` document types. Transfer and adjustment are explicitly rejected and remain Step 8.
- Requires an `approved` document. Draft/import-style, submitted, already-confirmed or otherwise out-of-sequence documents cannot bypass the existing submit/approve lifecycle. Structural completeness is checked again before any stock result is produced.
- Reuses Step 4 `validateInventoryDocumentScope` at confirmation time with trusted `InventoryScopeContext` and existing `InventoryScopeReaders`, rechecking Company, Branch access, fiscal year/period, historical locks and Warehouse Branch visibility.
- Revalidates current Product eligibility plus requested Warehouse/Zone/Location identity/status through the Step 3 public validation functions. Historical quantity/unit snapshots remain unchanged; current master edits do not rewrite historical conversion.
- Defines one-sided stock effects: Receipt emits positive base-unit deltas, Issue emits negative base-unit deltas, Opening emits positive base-unit deltas.
- Requires caller-supplied durable movement IDs and one positive `businessOrder`; no random identity, clock read, rowid or local array index is used as durable stock identity/order.
- Rebuilds ledger state from `ledger.movements` before applying candidates, intentionally ignoring caller-supplied balance projections. Missing ledger input is an error rather than an empty-stock fallback.
- Inherits Step 6 current/backdated/same-day negative-stock validation. A failed issue/backdated candidate returns no confirmation result and leaves caller document/ledger snapshots unchanged.
- Added `InventoryOpeningBalanceKey` and canonical serialization using Company + fiscal year + StockKey. Duplicate opening for the same fiscal-year StockKey is rejected both across existing opening keys and within one opening document.
- Malformed opening-key state is rejected rather than silently treated as no prior opening, preventing a caller from bypassing the duplicate-opening guard.
- Lifecycle confirmation occurs only after scope/master/opening/stock checks succeed. The result returns the confirmed immutable document, generated immutable movements, rebuilt ledger and normalized opening keys.
- Preserves Steps 9–13 boundaries: Step 7 does not define repositories/UoW, idempotency storage, optimistic transaction locks, migrations, SQLite persistence, durable `businessOrder` allocation, or atomic database writes. Later authoritative services must bind the supplied scope/master reads and writes to the committing transaction.
- Added 14 focused workflow tests covering receipt/issue signs, stock decrement, backdated rejection, fiscal/lock revalidation, opening traceability/duplicates, current Product/Warehouse revalidation, lifecycle/import bypass rejection, Step 8 type boundary, exact line/movement mapping, missing-ledger/malformed-opening guards, forged balance projection rejection and failure immutability.
- Updated the canonical Inventory architecture record and public package exports. No new ADR is required because this step applies already-accepted lifecycle, scope, quantity and ledger decisions without introducing a new persistence/transport decision.
- The repository owner explicitly accepted Step 7 in chat before requesting Step 8. Raw local command output was not pasted into the conversation; owner acceptance and executable evidence remain distinct facts.

#### Step 7 Validation Evidence

| Check | Result |
| --- | --- |
| Frozen Step 7 wording vs implementation | Reconciled: receipt/issue/opening semantics, opening traceability/duplicate guard, confirmation-time eligibility and stock revalidation, and no import bypass are represented |
| Public API | `confirmInventoryReceiptIssueOpening`, opening-key and confirmation-resolution contracts exported from `@argin/inventory` |
| Focused Step 7 test definitions | Added in `packages/inventory/tests/inventory-core-workflows.test.ts`; 14 tests defined |
| Defensive review | Added explicit rejection for missing ledger/malformed opening state; added confirmation-time Step 4 scope/fiscal/lock revalidation after initial implementation review |
| Executable package validation | Not observed by the assistant environment; no pass claim is made until local/CI `test`, `typecheck` and `build` output is available |
| Owner acceptance | Explicitly accepted in chat before Step 8 |

Step 7 is closed by owner acceptance while retaining truthful validation provenance.

#### Step 8 Handoff

Step 8 consumes the same approval/scope/master/stock boundaries and adds transfer conservation, signed adjustment, and append-only reversal compensation. Persistence-neutral batch failure never returns a partially updated caller ledger. Real durable transaction atomicity remains Step 13.

### Step 8 — Atomic Transfer and Quantity Adjustment Workflows — Completed

- Extended immutable StockMovement facts with optional durable `transferId` and `reversalOfMovementId`. Non-transfer/non-reversal movement factories normalize these fields to `null`; existing durable document/line/movement identity remains unchanged.
- Added/exported `confirmInventoryTransfer`. It accepts only approved Transfer documents, reruns the existing Step 4 Company/Branch/fiscal/lock/Warehouse visibility validation, and revalidates current Product plus source/destination Warehouse/Zone/Location eligibility before producing stock effects.
- Each Transfer line generates exactly two immutable facts under one durable `transferId`: negative source base quantity and equal positive destination base quantity. Source and destination StockKeys must differ and exact decimal conservation requires the pair to sum to zero.
- Supports intra-Warehouse physical transfer (for example Zone-to-Zone) and inter-Warehouse transfer through the same contract. Cross-Branch authorization remains the trusted Step 4 policy and requires both endpoint access.
- Rejects reused transfer identity and malformed/duplicate pair movement identities. Transfer IDs, movement IDs, document IDs and StockKeys are durable cross-store identities; no display number, rowid or array position becomes identity.
- Builds every transfer movement first, then evaluates the complete batch through one ledger rebuild. Insufficient source stock, destination failure, current-master rejection or any other invariant produces no returned half-transfer and leaves caller document/ledger snapshots unchanged.
- Added/exported `confirmInventoryQuantityAdjustment`. Adjustment confirmation requires approved lifecycle, current scope/master eligibility, exact line/movement mapping and a non-empty reason. The snapshotted signed Product base quantity is the stock effect; positive adds and negative subtracts.
- Adjustment reductions inherit the same historical negative-stock rule; valuation/cost meaning is explicitly excluded and remains Phase 21.
- Added/exported `reverseInventoryStockEffects`. A Confirmed original is never edited/deleted. Every original movement receives one exact inverse compensating fact under a distinct `reversalDocumentId`, linked by `reversalOfMovementId`; only after the complete batch is valid does the original lifecycle become `reversed`.
- Ledger rebuild validates persisted reversal references: referenced original must exist, be a non-reversal fact, belong to the same Company/StockKey, live under a different document ID and sum exactly to zero with its compensation. One original movement cannot be compensated twice.
- Reversal of already-consumed incoming stock can fail under the default negative-stock policy. Failed reversal leaves both original lifecycle and caller ledger unchanged.
- Reversal business date/order are explicit inputs at this persistence-neutral step. Authoritative fiscal eligibility for the separate reversal operation, durable idempotency, optimistic concurrency and atomic persistence are composed in Steps 9–13.
- Added focused Transfer/Adjustment tests covering inter-Warehouse conservation, intra-Warehouse physical movement, insufficient-source rollback semantics, duplicate transfer identity, malformed pair identities, destination eligibility, positive/negative adjustments, required reason, negative-stock rejection and wrong-document-type boundaries.
- Added focused reversal tests covering exact inverse compensation, lifecycle linkage, consumed-receipt rejection and duplicate compensation protection.
- Added [ADR-0020](../adr/ADR-0020-inventory-transfer-adjustment-workflows.md), dedicated architecture documentation and ADR registry/index entries. Full stock-count sessions and in-transit/two-stage logistics remain explicitly deferred.
- The repository owner explicitly accepted Step 8 in chat before requesting Step 9. Raw local command output was not pasted into the conversation; owner acceptance and executable evidence remain distinct facts.

#### Step 8 Validation Evidence

| Check | Result |
| --- | --- |
| Frozen Step 8 wording vs implementation | Reconciled: one transfer identity, two-sided exact conservation, intra/inter-Warehouse support, distinct StockKeys, failure rollback semantics, signed reasoned adjustment and deferred two-stage logistics are represented |
| Reversal handoff from Steps 5–7 | Completed with append-only `reversalOfMovementId` compensation and lifecycle linkage; no confirmed fact is destructively rewritten |
| Focused Step 8 tests | Added in `packages/inventory/tests/inventory-transfer-adjustment.test.ts` and `packages/inventory/tests/inventory-reversal.test.ts` |
| Defensive review | Added transfer/reversal durable linkage fields, duplicate-transfer/duplicate-compensation guards and persisted reversal-reference integrity checks |
| Executable package validation | Not observed by the assistant environment; no pass claim is made until local/CI `test`, `typecheck` and `build` output is available |
| Owner acceptance | Explicitly accepted in chat before Step 9 |

Step 8 is closed by owner acceptance while retaining truthful validation provenance.

#### Step 9 Handoff

Step 9 defines the persistence-neutral command/query/repository/UoW boundary around the completed document and stock workflows. No SQL/Tauri/HTTP dependency enters Domain, and all durable transfer/reversal grouping remains available to later adapters.

### Step 9 — Application, Query and Repository Contracts — Implemented; Validation Pending

- Added `application/contracts` for Inventory, following the established modular contract pattern used by upstream ERP modules while preserving Inventory-specific stock invariants.
- Added stable `InventoryApplicationError` codes for invalid requests, not-found records, optimistic concurrency, duplicate document numbers/movements/openings, stock conflicts, idempotency conflicts, authorization and dependency blocking. Consumers branch on code/field rather than parsing messages.
- Added Company-scoped document list/detail/by-number queries plus cursor-based quantity kardex and balance queries. Document pages are bounded to 200 rows and cursor readers to 500 rows; invalid page/cursor requests fail through the typed Application error contract.
- Added read-model DTOs for document list/detail, kardex entries with running quantity, balance rows, offset pages and cursor pages. Query readers are deliberately separated from mutation repositories.
- Added command contracts for create/save/delete/lifecycle/confirm/reverse operations with stable request key, canonical payload fingerprint and expected version where applicable. Caller-controlled `businessOrder` was deliberately removed after review; Step 10 must allocate it through the UoW-scoped business-order port.
- Added persistence-neutral repositories for documents, append-only movement facts, rebuildable balance projections, opening uniqueness facts, durable business-order allocation and idempotency records. Balance projection replacement is explicitly non-authoritative; movements remain stock truth.
- Added `InventoryUnitOfWork`/`InventoryUnitOfWorkContext` combining every confirmation-critical repository so Step 10 can orchestrate one logical mutation without depending on SQLite. Real commit/rollback semantics remain Step 13.
- Added future ERP consumer contracts: `InventorySourceDocumentPort.stageDraft` and `InventoryQuantityConfirmationPort.confirm`. Purchase/Sales/Manufacturing consumers submit durable source identity, quantity/unit intent and Warehouse references; they cannot inject raw movements or editable balances and cannot bypass Inventory lifecycle/stock rules.
- Added six focused contract tests covering bounded document pages, bounded opaque cursors, stable typed errors, complete UoW composition, separation of query reader from repositories and the future source staging/normal confirmation boundary.
- Added [Inventory Application, Query and Repository Contracts](../architecture/inventory-application-contracts.md). No new ADR is required because Step 9 applies existing Application Service/UoW/database-independent Domain decisions rather than changing architecture direction.
- No SQL, table name, migration, Tauri command, HTTP endpoint, infrastructure implementation, permission catalog, live Bridge transport, concurrency algorithm or idempotent replay behavior is introduced in Step 9.

#### Step 9 Validation Evidence

| Check | Result |
| --- | --- |
| Frozen Step 9 wording vs implementation | Reconciled: commands, bounded list/detail/kardex/balance readers, repositories, UoW, typed errors and future source-consumer ports are represented |
| Public API | All new Step 9 runtime constants/helpers and TypeScript contracts are exported from `@argin/inventory` |
| Focused Step 9 tests | Added in `packages/inventory/tests/inventory-contracts.test.ts`; 6 tests defined |
| Boundary review | Query reader separated from write repositories; caller cannot supply business order; external ERP ports accept business intent rather than raw movement/balance facts |
| Infrastructure boundary | No SQL/SQLite/Tauri/HTTP implementation added; UoW/idempotency are interfaces only |
| Executable package validation | Not observed by the assistant environment; no pass claim is made until local/CI `test`, `typecheck` and `build` output is available |

#### Step 10 Handoff

Step 10 must implement authoritative Application Services on these ports: request-key/payload-fingerprint replay and conflict semantics, expected-version comparison, transaction-bound validation, business-order allocation inside the UoW, and stock validation against concurrent mutations. It must not move SQLite implementation from Step 13 forward.

## Testing

Cover domain transitions, precise units, fiscal locks, scope, concurrent stock updates, retry payload conflicts, same-day/backdated ordering, no negative historical balances under the default policy, reversal over-consumption, transfer conservation, dependency guard behavior, and stock reconstruction. A posted/confirmed source may not be silently replaced or applied twice by future consumers.

Representative acceptance: receipt 10 units, issue 3, transfer 2 to another eligible Warehouse -> source 5, destination 2, company total 7. Repeating the transfer request leaves those values unchanged. A failed destination write changes neither side. Reversing a receipt after its stock was consumed must respect negative-stock/fiscal rules rather than deleting its movement.

## Validation Evidence

Planning/Step 1 checks and actual Steps 2–4 validation are recorded above. The last assistant-observed full Inventory package run remains the Step 4 result: 72 passing tests. Steps 5–9 add focused lifecycle/stock/workflow/contract tests but their workspace execution has not been observed in the assistant environment. Steps 5–8 have explicit owner acceptance. No migration, performance gate or manual Desktop acceptance has been run in this phase yet.

Required implementation gates, to be executed and recorded at Steps 19–21:

- Frozen dependency install.
- Inventory and SQLite adapter tests/typechecks.
- Related Product/Warehouse/Fiscal/Security/Audit and Desktop regression suites.
- Full monorepo lint, typecheck, test and build.
- Desktop Rust `cargo check` and applicable repository Rust gates.
- Documentation index generation/link checks and manual Desktop/print acceptance.
- Add `pnpm validate:phase20` in Step 21; this command does not exist yet.

## Documentation Impact

Kickoff: this record, root roadmap, roadmap compatibility page, phase index, changelog and generated documentation index.

Step 1: updated this record, roadmap, phase index, changelog, module registry and module map; no new document paths or titles.

Step 2: added the Inventory Domain architecture record and glossary terms, updated package/module registration and phase status, and regenerated the documentation index.

Step 5: updated this canonical record and the Inventory Domain architecture record for the six-state lifecycle, approval invalidation, Draft deletion/cancellation separation and linked reversal boundary.

Step 6: added ADR-0019 and updated this canonical record plus Inventory architecture for durable StockKey identity, append-only movement facts, exact arithmetic, stable `businessOrder`, rebuildable balances and negative-history policy.

Step 7: updated this canonical record and Inventory architecture for receipt/issue/opening confirmation, current eligibility revalidation, stock checks, opening uniqueness and lifecycle-bypass protection. No new documentation path or H1 title was introduced.

Step 8: added ADR-0020 and `inventory-transfer-adjustment-workflows.md`, updated the ADR registry/generated index, and recorded durable transfer/reversal grouping plus adjustment semantics in this canonical plan.

Step 9: added `inventory-application-contracts.md` and recorded bounded queries, mutation/query separation, repositories/UoW, typed errors and future ERP consumer ports. No ADR was added because existing ADR-0002/0005/0006 decisions already govern this boundary.

During implementation: canonical Inventory architecture and Bridge contracts, database design/dictionary, permissions/approval policy, module registry/map and domain glossary. Keep all repository documentation and commits in English.

## Related ADRs

[ADR-0018 — Exact Inventory Quantities and Historical Unit Snapshots](../adr/ADR-0018-inventory-quantity-snapshots.md) records the Step 3 representation decision.

[ADR-0019 — Append-only Inventory Stock Ledger and Rebuildable Balances](../adr/ADR-0019-inventory-stock-ledger.md) records the Step 6 movement source-of-truth, exact arithmetic, deterministic business ordering and negative-history policy.

[ADR-0020 — Atomic Inventory Transfer and Quantity Adjustment Workflows](../adr/ADR-0020-inventory-transfer-adjustment-workflows.md) records Step 8 transfer conservation, signed adjustments and append-only reversal compensation.

Follow [Offline First](../adr/ADR-0001-offline-first.md), [Database-independent Domain](../adr/ADR-0002-database-independent-domain.md), [UoW](../adr/ADR-0005-repository-unit-of-work.md), [Application Services](../adr/ADR-0006-application-services.md), [Approval Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md) and [Shared Platform](../adr/ADR-0009-platform-infrastructure-first.md).

## Exit Criteria

All fixed steps have implementation and actual validation evidence; quantity ledger reconciles with balances; retries and races cannot duplicate/lose stock; transfer/reversal are atomic and traceable; master-data guards are wired; UI/manual acceptance is recorded; documentation is current; final merge is explicitly authorized. Manual tag/release state is reported separately and truthfully.

## Next Phase

Phase 21 — Inventory Valuation consumes immutable movements and source/reversal/transfer links; it must not rewrite Phase 20 quantity facts.

## Change Requests

None. No implicit renumbering or step substitution is permitted.