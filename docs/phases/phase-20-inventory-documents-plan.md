# Phase 20 — Inventory Documents — Fixed Implementation Plan

## Status

In Progress. Steps 1–16 are complete; Steps 5–16 have been explicitly owner-accepted. Step 17 quantity Kardex, on-hand balance reporting, Branch-aware source drill-down, exact opening/in/out/closing reconciliation and focused adapter/Desktop tests are implemented; executable workspace/Desktop validation remains pending. Steps 18–22 are Not started.

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
- [Database Design](../database/database-design.md)
- [Database Dictionary](../database/database-dictionary.md)

### Argin Bridge Rules

Target topology: `Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`.

Document/line/movement/transfer/reversal identities remain stable across stores; display numbers, codes and SQLite row positions are never foreign identity. Company isolation is mandatory. UTC metadata and local optimistic version are distinct from optional server revision. Request replay must not double-decrease stock, even after restart.

Only eligible unconfirmed document deletion may produce a tombstone. Confirmed movements remain immutable and are corrected by linked compensating facts; cancellation, reversal and deletion are different operations. Atomic transfer/reversal grouping and dependency ordering must survive future delivery. Balances are derived locally from accepted movement facts, not independently editable synchronized stock values.

## Domain and Application Model

Implemented through Steps 2–17:

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
- Branch-aware quantity reporting contract and SQLite reader with exact Kardex reconciliation, on-hand balance projection, full chronology cursor and durable source document/line drill-down.

## Application Service Rules — Step 10

`InventoryApplicationService` executes stock-changing work through one `InventoryUnitOfWork.execute(...)` boundary:

1. Company-scoped idempotency lookup.
2. Durable document reload.
3. `expectedVersion` comparison.
4. Current scope/master validation.
5. Authoritative movement reads for affected StockKeys.
6. `businessOrder` allocation inside the UoW.
7. Workflow execution.
8. Movement append and balance projection replacement.
9. Opening-key persistence when applicable.
10. Document update.
11. Idempotency outcome persistence.

Same `requestKey + operation + payloadFingerprint` replays the original recorded outcome without adding another movement. Reusing the same request key with changed operation or fingerprint returns `inventory.application.idempotency-conflict`.

Document optimistic concurrency alone is insufficient for stock. Different documents can compete for the same StockKey, so stock facts must be read/rebuilt inside the same committing UoW. Callers cannot supply `businessOrder`; it is allocated inside the UoW.

## Persistence Model — Steps 11 and 13

Migration `0026_inventory_documents.sql` creates normalized document/line/lifecycle/movement/opening/balance/business-order/idempotency persistence. Migration `0027_inventory_reversal_persistence.sql` adds append-only reversal compensation facts and `inventory_all_stock_movements` as the authoritative logical movement ledger.

Key rules:

- Durable TEXT IDs remain separate from display document numbers.
- Exact entered/base quantities, movement deltas and balance quantities are TEXT decimal representations, never SQLite `REAL`.
- Nullable Zone/Location dimensions use normalized uniqueness semantics.
- Movement facts, reversal compensation, lifecycle history and opening facts are append-only.
- `inventory_stock_balances` is a rebuildable projection only; `inventory_all_stock_movements` is authoritative for quantity history.
- Document rows carry local synchronization metadata for future Bridge use without implementing live transport.
- Document CAS, business-order allocation and durable idempotency participate in the real transaction boundary.

## Security, Approval and Audit — Step 14

Inventory freezes ten independent permissions: view, create, edit, submit, approve, confirm, reverse, cancel, import and export. Approval and confirmation are separate authorities. `SecuredInventoryService` authorizes against persisted Company/Branch, delegates approval to the shared Phase 8 engine and records replay-safe Audit evidence.

## Master Data Dependency Guards and ERP Integration — Step 15

`InventoryWarehouseDependencyGuard` protects Warehouse/Zone/Location maintenance using non-zero stock, open documents and immutable history. Destructive delete and historical Location move preserve historical meaning; deactivate/archive allow history alone but block active stock/open documents.

`SecuredInventoryQuantityConfirmationPort` is the future Purchase/Sales/Manufacturing quantity-confirmation boundary. `InventoryMovementFeedReader` exposes bounded immutable facts for Phase 21/later consumers and never treats the balance projection as equivalent authoritative history.

## Persian RTL Inventory Document Workspace — Step 16

`InventoryDraftService` supplies create/save/delete Draft behavior inside Application/UoW/idempotency boundaries. `SqliteInventoryWorkspaceReader` supplies bounded Company-scoped list/detail reads. Desktop route `/inventory/documents` provides the Persian RTL receipt/issue/opening/transfer/adjustment editor with Product/Warehouse/Zone/Location selectors, Jalali input/display, exact quantity snapshots, separate lifecycle actions, shared Approval/history and stale-version recovery.

Business dates remain Gregorian internally. Quantity, codes and identifiers are explicitly LTR inside the RTL UI. Step 16 does not implement reports, import/export/print/PDF or valuation.

## Quantity Kardex, Stock Balances and Source Drill-down — Step 17

`InventoryQuantityReportReader` freezes the persistence-neutral reporting boundary. `SqliteInventoryQuantityReportReader` implements it with a maximum 500-row request size; Desktop requests 100 rows.

Kardex reads `inventory_all_stock_movements`, not the balance projection. Canonical chronology remains:

`businessDate -> businessOrder -> documentId -> lineId -> movementId`.

The opaque continuation cursor carries that full tuple. Arrival time, SQLite row order and movement ID alone never define chronology.

Kardex returns opening, incoming, outgoing, closing and per-row running quantities. All arithmetic uses exact canonical decimal strings through `addInventoryStockQuantities`; no JavaScript floating point or SQLite `REAL` accumulation is used. Historical prefix reconstruction uses bounded keyset chunks of 500 facts. The continuation invariant is:

`closing(page N) == opening(page N + 1)`.

For a date-filtered first page, opening includes all authoritative facts before the requested start date. For later pages, opening includes the previous page's cursor movement because the next page starts strictly after that fact.

Balance reporting reads `inventory_stock_balances` as a rebuildable on-hand projection and joins Product/Warehouse/Zone/Location only for display labels. Quantity is returned as the canonical decimal string. Filters include Product, Warehouse, Zone, Location and include-zero.

Branch scope is enforced twice: Desktop composition validates the active Branch against the authenticated actor, and the SQLite report reader permits company-wide Warehouses plus Warehouses owned by the active Branch. Kardex rejects a Branch-owned Warehouse outside the requested Branch scope. Source-document drill-down is likewise Branch guarded unless `system.full-access` applies.

Desktop route `/inventory/reports` adds Persian RTL balance/Kardex views, Jalali date filters, exact LTR quantity/code display and durable source drill-down by `documentId + lineId`. It explicitly explains backdated effects and distinguishes **On-hand** from deferred reservations / Available-to-Promise.

Step 17 does not add valuation, monetary/Rial totals, import/export, Excel, print or PDF.

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
| 17 | Quantity Kardex, Stock Balances and Source Drill-down | Implemented — validation pending |
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

### Steps 1–4 — Completed with Executed Validation

- Step 1 froze the branch/scope/22-step sequence and reconciled Phase 19/develop baseline.
- Step 2 established the Inventory Domain package and immutable document model.
- Step 3 added exact quantity/unit snapshots and Warehouse operational references.
- Step 4 added Company/Branch/fiscal validation and numbering boundaries.
- Last assistant-observed full package run remains Step 4: 72 tests passed, typecheck passed and build passed.

### Steps 5–15 — Completed and Owner Accepted

- Step 5 delivered the six-state lifecycle and correction/reversal rules.
- Step 6 delivered append-only exact quantity ledger and rebuildable balances.
- Step 7 delivered receipt/issue/opening workflows and opening uniqueness.
- Step 8 delivered atomic transfer, quantity adjustment and append-only reversal compensation.
- Step 9 delivered Application/query/repository/UoW/future-consumer contracts.
- Step 10 delivered orchestration, idempotency, optimistic concurrency and stock race handling.
- Step 11 delivered migration `0026_inventory_documents.sql` and constraints/indexes.
- Step 12 delivered versioned Argin Bridge document/movement-batch contracts.
- Step 13 delivered `@argin/inventory-tauri`, migration `0027`, pinned SQLite transactions, CAS, business-order and durable idempotency.
- Step 14 delivered independent permissions, shared Approval integration and replay-safe Audit.
- Step 15 delivered Warehouse dependency guards, secured ERP confirmation and immutable movement feed.
- Each of Steps 5–15 was explicitly owner-accepted. Raw local outputs were not pasted for the later steps; owner acceptance and executable evidence remain distinct facts.

### Step 16 — Persian RTL Inventory Document Workspace — Completed

- Added Application-owned create/save/delete Draft operations and bounded SQLite list/detail reader.
- Added `/inventory/documents`, Persian RTL editor, Jalali boundary, exact line quantity/unit snapshots and bounded Product/Warehouse/Zone/Location selectors.
- Added secured Submit/Approve/Confirm/Cancel/Reverse actions, shared Approval/history and stale-version reload behavior.
- Added four Desktop workspace contract tests and [Inventory Desktop Workspace](../architecture/inventory-desktop-workspace.md).
- Owner explicitly accepted Step 16 before requesting Step 17. Raw executable output was not pasted into the conversation.

### Step 17 — Quantity Kardex, Stock Balances and Source Drill-down — Implemented; Validation Pending

- Added persistence-neutral quantity reporting contracts in `@argin/inventory`.
- Added `SqliteInventoryQuantityReportReader` over authoritative `inventory_all_stock_movements` for Kardex and rebuildable `inventory_stock_balances` for current on-hand balances.
- Added full chronology cursoring and exact opening/in/out/closing/running quantity arithmetic.
- Added bounded keyset prefix reconstruction and corrected page continuity so `closing(page N) == opening(page N + 1)`.
- Added Product/Warehouse/Zone/Location balance filters and bounded cursor pagination.
- Added Branch-aware Warehouse visibility and source-document drill-down guards.
- Added `/inventory/reports` Persian RTL balance/Kardex workspace with Jalali date filters, backdated-order explanation, exact LTR quantities and durable document/line source detail.
- Added three focused Inventory-Tauri tests: page reconciliation, exact large-decimal preservation and cross-Branch Kardex rejection.
- Added four Desktop contract tests covering route/permission, chronology/on-hand semantics, source drill-down and Step 18/Phase 21 scope exclusion.
- Added [Inventory Quantity Kardex, Balances and Source Drill-down](../architecture/inventory-quantity-reports.md).

#### Step 17 Validation Evidence

| Check | Result |
| --- | --- |
| Authoritative Kardex | Reads `inventory_all_stock_movements` in canonical business chronology |
| Balance semantics | Reads rebuildable on-hand projection; projection is not promoted to authoritative history |
| Exact arithmetic | Opening/in/out/closing/running values use canonical decimal strings and Inventory exact addition |
| Cursor continuity | Full chronology tuple; next-page opening includes prior page cursor fact |
| Bounded reads | Report request max 500; historical prefix reconstruction uses 500-fact keyset chunks |
| Branch scope | Company-wide + active-Branch Warehouses only; cross-Branch Kardex is rejected |
| Source drill-down | Durable `documentId + lineId`, guarded by Company/Branch context |
| Desktop UI | `/inventory/reports`, Persian RTL, Jalali date filters, exact LTR quantities, On-hand/ATP explanation |
| Focused Step 17 tests | 3 Inventory-Tauri + 4 Desktop contract tests defined |
| Executable package/Desktop validation | Not observed by the assistant environment; no pass claim is made before local output |

#### Step 18 Handoff

Step 18 must add preview/validation and retry-safe Draft import, Excel export, and native print/PDF for Inventory documents and quantity reports using shared tooling. It must preserve Persian RTL, established full-screen print preview behavior, orientation/pagination and bottom spacing. Import must never bypass explicit authorized confirmation. Step 18 must not add valuation or monetary stock amounts.

## Testing

Cover domain transitions, precise units, fiscal locks, scope, concurrent stock updates, retry payload conflicts, same-day/backdated ordering, no negative historical balances under the default policy, reversal over-consumption, transfer conservation, dependency guard behavior and stock reconstruction. A confirmed source may not be silently replaced or applied twice by future consumers.

Representative acceptance: receipt 10 units, issue 3, transfer 2 to another eligible Warehouse -> source 5, destination 2, company total 7. Repeating the same transfer request leaves those values unchanged. A failed destination write changes neither side.

## Validation Evidence

The last assistant-observed full Inventory package execution remains Step 4: 72 tests passed, typecheck passed and build passed. Steps 5–17 define focused lifecycle/stock/workflow/contract/orchestration/migration/Bridge/SQLite/security/integration/Desktop/reporting tests, but their current workspace execution has not been observed by the assistant environment. Steps 5–16 have explicit owner acceptance. Real migration upgrade/constraint/rollback/restart and Desktop integration validation remain required in Step 20; final monorepo gates remain Step 21.

Required implementation gates, to be executed and recorded at Steps 19–21:

- Frozen dependency install.
- Inventory and SQLite adapter tests/typechecks.
- Related Product/Warehouse/Fiscal/Security/Audit and Desktop regression suites.
- Full monorepo lint, typecheck, test and build.
- Desktop Rust `cargo check` and applicable repository Rust gates.
- Documentation index generation/link checks and manual Desktop/print acceptance.
- Add `pnpm validate:phase20` in Step 21.

## Documentation Impact

- Steps 2–9 created/updated canonical Inventory Domain/workflow/Application-contract records and ADR-0018 through ADR-0020 as applicable.
- Step 10 added `inventory-application-services.md`.
- Step 11 added migration `0026_inventory_documents.sql` and database records.
- Step 12 added `inventory-argin-bridge-contract.md`.
- Step 13 created `@argin/inventory-tauri`, added migration `0027` and `inventory-sqlite-persistence.md`.
- Step 14 added `inventory-security-approval-audit.md`.
- Step 15 added `inventory-master-data-erp-integration.md`.
- Step 16 added `inventory-desktop-workspace.md`.
- Step 17 added `inventory-quantity-reports.md`, reporting contracts/reader and Persian RTL quantity report route.
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
