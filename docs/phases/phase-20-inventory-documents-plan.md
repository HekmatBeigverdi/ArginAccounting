# Phase 20 — Inventory Documents — Fixed Implementation Plan

## Status

In Progress. Steps 1–19 are complete and owner-accepted. Step 20 real SQLite migration/upgrade, constraint, rollback, restart, balance-rebuild and Desktop integration coverage is implemented; executable validation is pending. Steps 21–22 are Not started.

## Governance

This 22-step sequence is frozen. Titles, order, scope and exit criteria change only through an explicitly approved Change Request. Update Step Status and evidence in this same file after every step; distinguish implemented, actually validated and owner-accepted work. Do not create routine step-status files.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [GitHub Publishing Workflow](../development/github-publishing-workflow.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Contributing](../../CONTRIBUTING.md)

## Overview and Objectives

Deliver the offline quantity-document foundation: receipts, issues, opening quantities, atomic transfers, reasoned quantity adjustments, controlled confirmation/reversal, append-only stock movements, rebuildable on-hand balances and quantity Kardex. Preserve future Argin Bridge compatibility from the start.

The canonical [roadmap](../../ROADMAP.md) places Inventory Documents at Phase 20, Inventory Valuation at Phase 21 and Purchase Workflow at Phase 22. Older offline guide numbering must not override this source.

## Baseline and Release Target

- Planning baseline: develop at `3f20840a2617873be7f954db99f4da52ce61b6c7`.
- Phase 19 canonical record marks Steps 1–20 complete and records its merge to develop.
- Branch: `phase/20-inventory-documents`.
- Target version/tag: `0.20.0` / `v0.20.0`.
- Release title: `ArginAccounting v0.20.0 — Inventory Documents`.
- Tag and GitHub Release publication remain manual owner actions.

## Scope

### Included

- Quantity receipt/issue/opening/transfer/adjustment documents with stable line identities.
- Fiscal and organizational eligibility, numbering, approval, confirmation and linked reversal.
- Exact unit conversion snapshots, stock ledger, on-hand balance projection and quantity Kardex.
- Inventory-backed master-data dependency guards.
- SQLite persistence, permission/audit integration, draft import, export, print/PDF and Persian RTL desktop UI.
- Persistence-neutral future-consumer and Argin Bridge change contracts.

### Excluded and Deferred

- Phase 21: FIFO/moving-average valuation, cost layers, landed costs, monetary revaluation and valuation reports.
- Phase 22 onward: Purchase/Sales commercial workflows, invoices, transactional prices and taxes; owning modules consume Inventory confirmation ports.
- Owning posting phases: accounting entries/posting rules. Inventory confirmation is not Journal posting.
- Full stock-count sessions, reservations/available-to-promise, lot/serial/expiry tracking and in-transit two-stage transfers require explicit later planning.
- Phase 45: live Bridge transport, outbox processing, acknowledgement, retries, checkpoints, PostgreSQL/.NET implementation and conflict-resolution UI.
- Taxpayer submission/signing/inquiry and Manufacturing workflows remain outside this phase.

## Architecture

Confirmed package boundary: `@argin/inventory` owns Domain/Application and `@argin/inventory-tauri` owns SQLite/shared Desktop adapters. UI consumes public Application/reporting services through Desktop composition.

Reuse Company/Branch, Fiscal, Product units/selectors, Warehouse operational references/selectors, Security, Audit/Approval, Number Series, shared UoW and query infrastructure. Never write another module's tables directly.

References:

- [Warehouse ERP ownership](../architecture/warehouse-inventory-erp-integration.md)
- [Warehouse synchronization](../architecture/warehouse-sync-contract.md)
- [Party Argin Bridge](../architecture/party-argin-bridge-contract.md)
- [Inventory Document Domain Foundation](../architecture/inventory-documents.md)
- [Transfer, adjustment and reversal workflows](../architecture/inventory-transfer-adjustment-workflows.md)
- [Inventory Application contracts](../architecture/inventory-application-contracts.md)
- [Inventory Application Services](../architecture/inventory-application-services.md)
- [Inventory Argin Bridge contract](../architecture/inventory-argin-bridge-contract.md)
- [Inventory SQLite persistence](../architecture/inventory-sqlite-persistence.md)
- [Inventory Security, Approval, and Audit](../security/inventory-security-approval-audit.md)
- [Inventory Master Data Dependency Guards and ERP Integration](../architecture/inventory-master-data-erp-integration.md)
- [Inventory Desktop Workspace](../architecture/inventory-desktop-workspace.md)
- [Inventory Quantity Kardex, Balances and Source Drill-down](../architecture/inventory-quantity-reports.md)
- [Phase 20 Domain/Application Test Matrix](../testing/phase-20-domain-application-tests.md)
- [Phase 20 SQLite/Desktop Integration Tests](../testing/phase-20-sqlite-desktop-integration-tests.md)
- [Database Design](../database/database-design.md)
- [Database Dictionary](../database/database-dictionary.md)

### Argin Bridge Rules

Target topology: `Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`.

Document/line/movement/transfer/reversal identities remain stable across stores; display numbers, codes and SQLite row positions are never foreign identity. Company isolation is mandatory. UTC metadata and local optimistic version are distinct from optional server revision. Request replay must not double-decrease stock, even after restart.

Only eligible unconfirmed document deletion may produce a tombstone. Confirmed movements remain immutable and are corrected by linked compensating facts; cancellation, reversal and deletion are different operations. Atomic transfer/reversal grouping and dependency ordering must survive future delivery. Balances are derived locally from accepted movement facts, not independently editable synchronized stock values.

## Domain and Application Model

Implemented through Steps 2–20:

- Immutable `InventoryDocumentSnapshot` and stable line/source identities.
- Exact decimal quantity and historical unit snapshots.
- Company/Branch/fiscal scope and numbering boundaries.
- Six-state lifecycle with approval/confirmation separation and linked reversal.
- Append-only `InventoryStockMovementSnapshot` and rebuildable balances.
- Receipt/issue/opening workflows and fiscal-year opening uniqueness.
- Atomic transfer grouping/conservation, signed adjustments and append-only reversal compensation.
- Persistence-neutral commands, bounded queries, repositories, typed errors and UoW contracts.
- `InventoryApplicationService` orchestration for lifecycle actions, confirmation, replay-safe idempotency, expected-version checks, UoW-scoped business ordering and reversal scope/date validation.
- Versioned Argin Bridge document/movement-batch contracts with indivisible transfer/reversal semantics and no synchronized authoritative balance projection.
- Concrete SQLite repositories/UoW plus a production pinned-connection transaction bridge with real `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` semantics.
- Separate Inventory permissions, persisted-document Company/Branch authorization, shared Phase 8 Approval gateway and shared immutable Audit adapter around successful lifecycle operations.
- Concrete Inventory-backed Warehouse dependency guard, secured ERP confirmation adapter and bounded immutable movement feed for valuation/later consumers.
- Persian RTL Desktop workspace with Application-owned draft mutation, bounded list/detail read model, Jalali input/display, exact quantity/unit editing and secured lifecycle actions.
- Branch-aware quantity reporting with aggregate Product view, Warehouse/location breakdown, exact Kardex reconciliation and durable source drill-down.
- Previewed retry-safe Draft import plus Excel/Print/PDF output without implicit confirmation.
- Focused Domain/Application regression matrix for lifecycle, quantity, scope, stock chronology, workflows, replay/concurrency, dependency policy and Bridge invariants.
- Real SQLx SQLite migration/upgrade, constraint, rollback, restart and balance-rebuild integration suites plus production Desktop dependency-guard bootstrap.

## Core Invariants

`InventoryApplicationService` executes stock-changing work through one `InventoryUnitOfWork.execute(...)` boundary: idempotency lookup, durable document reload, `expectedVersion`, current scope/master validation, authoritative movement read, business-order allocation, workflow execution, movement append, balance projection replacement, opening-key persistence where applicable, document update and idempotency outcome persistence.

Same `requestKey + operation + payloadFingerprint` replays the original recorded outcome without adding another movement. Reusing the same request key with changed operation or fingerprint returns `inventory.application.idempotency-conflict`.

Document optimistic concurrency alone is insufficient for stock. Different documents can compete for the same StockKey, so stock facts must be read/rebuilt inside the same committing UoW. Callers cannot supply `businessOrder`; it is allocated inside the UoW.

Migration `0026_inventory_documents.sql` creates normalized document/line/lifecycle/movement/opening/balance/business-order/idempotency persistence. Migration `0027_inventory_reversal_persistence.sql` adds append-only reversal compensation facts and `inventory_all_stock_movements` as the authoritative logical movement ledger.

Exact entered/base quantities, movement deltas and balance quantities are TEXT decimal representations, never SQLite `REAL`. Movement facts, reversal compensation, lifecycle history and opening facts are append-only. `inventory_stock_balances` is a rebuildable projection only.

Inventory freezes ten independent permissions: view, create, edit, submit, approve, confirm, reverse, cancel, import and export. Approval and confirmation remain separate authorities.

Kardex canonical chronology is `businessDate -> businessOrder -> documentId -> lineId -> movementId`; backdated facts are validated in this chronology. The default stock policy rejects a negative running balance at any historical point, not merely a negative final balance.

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
| 9 | Application, Query and Repository Contracts | Completed |
| 10 | Application Services, Idempotency and Concurrency | Completed |
| 11 | Migration, Schema, Constraints and Indexing | Completed |
| 12 | Argin Bridge and Future Synchronization Contract | Completed |
| 13 | SQLite Repository, Unit of Work and Atomic Confirmation | Completed |
| 14 | Permissions, Audit and Shared Approval Integration | Completed |
| 15 | Master Data Dependency Guards and ERP Integration | Completed |
| 16 | Persian RTL Inventory Document Workspace | Completed |
| 17 | Quantity Kardex, Stock Balances and Source Drill-down | Completed |
| 18 | Import, Export, Print and PDF | Completed |
| 19 | Domain and Application Tests | Completed |
| 20 | SQLite, Migration and Desktop Integration Tests | Implemented — validation pending |
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
Allocate the next unused migration after baseline inventory (latest observed at planning: 0025). Define scoped keys, line/movement/source uniqueness, precision encoding, versions, tombstones, sync metadata, balance projection and durable idempotency; update database dictionary. Released migrations remain immutable.

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

### Steps 1–18 — Completed and Owner Accepted

- Steps 1–15 established Domain, quantity/unit snapshots, scope, lifecycle, ledger, workflows, Application contracts/services, migrations, Bridge, SQLite UoW, security/approval/audit, dependency guards and ERP boundaries.
- Step 16 delivered the Persian RTL Inventory workspace.
- Step 17 delivered Product-aggregate and Warehouse/location quantity reporting plus exact Kardex/source drill-down.
- Step 18 delivered retry-safe Draft import, Excel export and RTL Print/PDF.
- The last assistant-observed full Inventory package execution remains Step 4; later owner acceptance is distinct from executable evidence.

### Step 19 — Domain and Application Tests — Completed and Owner Accepted

- Reconciled the focused Domain/Application suite against every frozen Step 19 criterion.
- Added exact large-decimal and historical backdated-negative regressions.
- Added Bridge transfer/reversal/tombstone contract regressions.
- Retained concurrent same-StockKey Application behavior, idempotency conflict and optimistic-version tests.
- Added fake-executor Warehouse dependency policy tests without pretending they are real SQLite tests.
- Owner explicitly accepted Step 19 before requesting Step 20.

### Step 20 — SQLite, Migration and Desktop Integration Tests — Implemented; Validation Pending

- Added `phase20_inventory_sqlite_integration.rs`, which opens real SQLx SQLite connections and executes the checked-in migration chain.
- Added a Phase 19 schema (`0025`) -> Inventory (`0026`/`0027`) upgrade scenario and verifies pre-existing master data survives.
- Added real SQLite constraint checks for scoped numbering, Company isolation and append-only movement triggers.
- Added a failed-transfer `BEGIN IMMEDIATE` rollback scenario proving no partial document or movement remains.
- Added successful two-fact transfer conservation, one-time reversal compensation and unified authoritative ledger checks.
- Added file-backed database close/reopen validation for durable movement and idempotency state.
- Added `phase20_inventory_balance_rebuild.rs`, which deliberately corrupts and rebuilds `inventory_stock_balances` from `inventory_all_stock_movements` without rewriting authoritative facts.
- Added Desktop integration contract coverage for routes, secured lifecycle composition and Step 18 import/export/print composition.
- Added a production `InventoryWarehouseIntegrationProvider` at the Desktop composition root. It registers the concrete `InventoryWarehouseDependencyGuard` before routes render and cleans it up on unmount.
- Extended the Phase 19 Warehouse dependency port with runtime registration while preserving explicit per-service dependency injection priority and package direction.
- Added behavioral Warehouse registration tests so guard wiring is not represented only by a source-text assertion.
- See [Phase 20 SQLite/Desktop Integration Tests](../testing/phase-20-sqlite-desktop-integration-tests.md).

#### Step 20 Validation Evidence

| Check | Result |
| --- | --- |
| Real SQLite migration chain | Integration test defined with SQLx SQLite |
| Upgrade 0025 -> 0026/0027 | Integration test defined; preserves seeded Company/Product/Warehouse data |
| Unique/FK/append-only constraints | Real SQLite assertions defined |
| Failed transfer rollback | Real `BEGIN IMMEDIATE`/`ROLLBACK` integration scenario defined |
| Successful transfer/reversal | Real SQLite conservation + compensation uniqueness checks defined |
| Durable retry/restart | File-backed close/reopen + idempotency uniqueness test defined |
| Balance rebuild | Real SQLite projection corruption/rebuild test defined |
| Desktop import/export/secured composition | Desktop integration contract defined |
| Warehouse master-data guard wiring | Production provider + behavioral registration test defined |
| Executable validation | Pending; no pass claim until actual local/CI command output is observed |

#### Step 21 Handoff

Step 21 must execute representative large-data query plans, accessibility/manual Desktop acceptance, full focused and monorepo gates, Rust checks, documentation index/link validation and final canonical documentation reconciliation. It must record actual command outputs rather than infer pass status from committed test definitions.

## Testing

Representative quantity acceptance remains: receipt 10 units, issue 3, transfer 2 to another eligible Warehouse -> source 5, destination 2, company total 7. Repeating the same transfer request leaves those values unchanged. A failed destination write changes neither side.

Step 20 executable gates:

```bash
pnpm --filter @argin/inventory test
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory-tauri test
pnpm --filter @argin/inventory-tauri typecheck
pnpm --filter @argin/warehouse test
pnpm --filter @argin/warehouse typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop build

cd apps/desktop/src-tauri
cargo test --test phase20_inventory_sqlite_integration
cargo test --test phase20_inventory_balance_rebuild
cargo check
```

## Documentation Impact

- Steps 2–9 created/updated canonical Inventory Domain/workflow/Application-contract records and ADR-0018 through ADR-0020 as applicable.
- Step 10 added `inventory-application-services.md`.
- Step 11 added migration `0026_inventory_documents.sql` and database records.
- Step 12 added `inventory-argin-bridge-contract.md`.
- Step 13 created `@argin/inventory-tauri`, added migration `0027` and `inventory-sqlite-persistence.md`.
- Step 14 added `inventory-security-approval-audit.md`.
- Step 15 added `inventory-master-data-erp-integration.md`.
- Step 16 added `inventory-desktop-workspace.md`.
- Step 17 added `inventory-quantity-reports.md` and the aggregate/detailed quantity-report UX.
- Step 18 added Inventory import/export/print/PDF implementation and focused contract coverage.
- Step 19 added `phase-20-domain-application-tests.md` and high-value behavioral regressions.
- Step 20 added `phase-20-sqlite-desktop-integration-tests.md`, real SQLx SQLite integration tests and Desktop Warehouse/Inventory guard bootstrap.
- Generated documentation index refresh remains Step 21.

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
