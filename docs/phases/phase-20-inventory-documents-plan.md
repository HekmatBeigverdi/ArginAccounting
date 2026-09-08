# Phase 20 — Inventory Documents — Fixed Implementation Plan

## Status

In Progress. Steps 1–9 are complete; Steps 5–9 have been explicitly owner-accepted. Step 10 implementation and focused Application-service test definitions are complete; executable workspace validation remains pending. Steps 11–22 are Not started; migrations, Argin Bridge envelopes, SQLite integration, permissions/Audit, Desktop UI and final validation remain pending.

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
- Phase 19 canonical record marks Steps 1–20 complete and records its merge to develop.
- Branch: `phase/20-inventory-documents`.
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
- Full stock-count sessions, reservations/available-to-promise, lot/serial/expiry tracking and in-transit two-stage transfers require explicit later planning.
- Phase 45: live Bridge transport, outbox processing, acknowledgement, retries, checkpoints, PostgreSQL/.NET implementation and conflict-resolution UI.
- Taxpayer submission/signing/inquiry and Manufacturing workflows remain outside this phase.

## Architecture

Confirmed package boundary: `@argin/inventory` owns Domain/Application and `@argin/inventory-tauri` will own SQLite adapters. UI consumes public Application services through Desktop composition.

Reuse Company/Branch, Fiscal, Product units/selectors, Warehouse operational references/selectors, Security, Audit/Approval, Number Series, shared UoW and query infrastructure. Never write another module's tables directly.

References:

- [Warehouse ERP ownership](../architecture/warehouse-inventory-erp-integration.md)
- [Warehouse synchronization](../architecture/warehouse-sync-contract.md)
- [Party Argin Bridge](../architecture/party-argin-bridge-contract.md)
- [Inventory Document Domain Foundation](../architecture/inventory-documents.md)
- [Transfer, adjustment and reversal workflows](../architecture/inventory-transfer-adjustment-workflows.md)
- [Inventory Application contracts](../architecture/inventory-application-contracts.md)
- [Inventory Application Services](../architecture/inventory-application-services.md)

### Argin Bridge Rules

Target topology: `Argin Desktop -> SQLite -> Argin Bridge -> .NET API / PostgreSQL -> Synchronization`.

Document/line/movement/transfer/reversal identities remain stable across stores; display numbers, codes and SQLite row positions are never foreign identity. Company isolation is mandatory. UTC metadata and local optimistic version are distinct from optional server revision. Request replay must not double-decrease stock, even after restart.

Only eligible unconfirmed document deletion may produce a tombstone. Confirmed movements remain immutable and are corrected by linked compensating facts; cancellation, reversal and deletion are different operations. Atomic transfer/reversal grouping and dependency ordering must survive future delivery. Balances are derived locally from accepted movement facts, not independently editable synchronized stock values.

## Domain and Application Model

Implemented through Steps 2–10:

- Immutable `InventoryDocumentSnapshot` and stable line/source identities.
- Exact decimal quantity and historical unit snapshots.
- Company/Branch/fiscal scope and numbering boundaries.
- Six-state lifecycle with approval/confirmation separation and linked reversal.
- Append-only `InventoryStockMovementSnapshot` and rebuildable balances.
- Receipt/issue/opening workflows and fiscal-year opening uniqueness.
- Atomic transfer grouping/conservation, signed adjustments and append-only reversal compensation.
- Persistence-neutral commands, bounded queries, repositories, typed errors and UoW contracts.
- `InventoryApplicationService` orchestration for lifecycle actions, confirmation, replay-safe idempotency, expected-version checks, UoW-scoped business ordering and reversal scope/date validation.

Still planned in owning steps: migrations, Bridge envelopes, concrete SQLite transactions/adapters, authorization/Audit integration, dependency guards, Desktop surfaces, reporting/export/print and final validation.

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

Document optimistic concurrency alone is insufficient for stock. Two different documents can compete for the same StockKey, so stock facts must be read/rebuilt inside the same committing UoW. The UoW contract therefore requires conflicting stock mutations to serialize or surface an optimistic/serialization conflict. Concrete SQLite behavior remains Step 13.

Callers cannot supply `businessOrder`; it is allocated inside the UoW. Reversal carries its own `businessDate` and `reversalScope`, so a compensating operation may be validated in a different open fiscal period from the original document without rewriting the original document's date/scope.

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
| 10 | Application Services, Idempotency and Concurrency | Implemented — validation pending |
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

### Step 5 — Document Lifecycle, Approval and Correction Rules — Completed

- Six-state lifecycle and explicit transition matrix delivered.
- Approval and confirmation remain distinct; approval has no stock effect.
- Confirmed facts cannot be directly edited/deleted and reversal is linked through a separate durable identity.
- Owner explicitly accepted Step 5. Workspace execution after Step 4 was not observed by the assistant environment.

### Step 6 — Stock Movement Ledger and Balance Rules — Completed

- Durable StockKey, append-only movements, exact arithmetic and deterministic business ordering delivered.
- Rebuildable balances and default historical negative-stock rejection delivered.
- Owner explicitly accepted Step 6. Focused Step 6 tests exist; current raw workspace output was not observed by the assistant environment.

### Step 7 — Receipt, Issue and Opening Balance Workflows — Completed

- Persistence-neutral receipt/issue/opening confirmation and current scope/master/stock revalidation delivered.
- Fiscal-year opening uniqueness and import/lifecycle bypass protection delivered.
- Owner explicitly accepted Step 7. Focused Step 7 tests exist; current raw workspace output was not observed by the assistant environment.

### Step 8 — Atomic Transfer and Quantity Adjustment Workflows — Completed

- Transfer pairing/conservation, intra/inter-Warehouse transfer, signed reasoned adjustment and append-only reversal compensation delivered.
- Reversal reference integrity and duplicate-compensation protection delivered.
- Owner explicitly accepted Step 8. Focused Step 8 tests exist; current raw workspace output was not observed by the assistant environment.

### Step 9 — Application, Query and Repository Contracts — Completed

- Persistence-neutral commands, bounded queries, read DTOs, typed Application errors, repository ports, UoW and future ERP consumer ports delivered.
- Query reader is separated from mutation repositories; caller-controlled `businessOrder` is prohibited.
- Owner explicitly accepted Step 9 before requesting Step 10.
- Focused Step 9 tests exist in `packages/inventory/tests/inventory-contracts.test.ts`; raw package execution was not pasted into the conversation, so owner acceptance and executable evidence remain distinct.

### Step 10 — Application Services, Idempotency and Concurrency — Implemented; Validation Pending

- Added/exported `InventoryApplicationService` for submit/approve/cancel/confirm/reverse orchestration.
- Idempotency is checked before mutation using Company + request key. Same operation/fingerprint replays the stored outcome; changed operation/fingerprint conflicts.
- Idempotency records now retain resulting document status/version so replay does not depend on later lifecycle mutations.
- Every mutation reloads the document inside the UoW and compares `expectedVersion`; stale callers fail before stock writes.
- Confirmation rebuilds authoritative ledger state from movement facts for all affected StockKeys inside the UoW before evaluating a new candidate.
- `businessOrder` is allocated inside the UoW; callers cannot inject chronology.
- Confirmation composes the existing receipt/issue/opening/transfer/adjustment workflows and writes movement batch, balance projection, opening keys, document version and idempotency outcome through the same UoW context.
- UoW contract now explicitly requires conflicting StockKey mutation transactions to serialize or surface a serialization/optimistic conflict. Concrete SQLite enforcement remains Step 13.
- Reversal now carries independent `businessDate` and `reversalScope`, validates the compensating operation against current fiscal/lock rules and never rewrites the original document date/scope.
- Added focused Application-service tests covering same-key replay without duplicate movement, fingerprint conflict, stale expected version and concurrent reductions against the same StockKey where only one mutation may succeed.
- Added [Inventory Application Services, Idempotency, and Concurrency](../architecture/inventory-application-services.md).
- Strict `exactOptionalPropertyTypes` review corrected optional negative-stock policy composition.

#### Step 10 Validation Evidence

| Check | Result |
| --- | --- |
| Frozen Step 10 wording vs implementation | Reconciled: validation/numbering/lifecycle/confirmation orchestration, request-key replay/conflict, expected-version comparison, UoW-scoped business order and concurrent StockKey validation are represented |
| Public API | `InventoryApplicationService` and dependency/result contracts exported from `@argin/inventory` |
| Focused Step 10 tests | Added in `packages/inventory/tests/inventory-application-service.test.ts`; 4 high-value orchestration tests defined |
| Race coverage | Two independent documents compete for the same StockKey; serialized UoW fixture permits only one stock-reducing confirmation |
| Persistence boundary | No SQL, migration, SQLite adapter, Tauri or HTTP implementation added; concrete transaction/isolation remains Step 13 |
| Executable package validation | Not observed by the assistant environment; no pass claim is made until local/CI `test`, `typecheck` and `build` output is available |

#### Step 11 Handoff

Step 11 must translate the completed Domain/Application contracts into durable schema constraints and indexes without changing released migrations. It must inventory the actual current migration registry before assigning the next number and must encode document/source/movement/opening/idempotency/business-order uniqueness, exact quantity storage, versions, tombstones, sync metadata and balance projection. SQLite repository behavior itself remains Step 13.

## Testing

Cover domain transitions, precise units, fiscal locks, scope, concurrent stock updates, retry payload conflicts, same-day/backdated ordering, no negative historical balances under the default policy, reversal over-consumption, transfer conservation, dependency guard behavior and stock reconstruction. A confirmed source may not be silently replaced or applied twice by future consumers.

Representative acceptance: receipt 10 units, issue 3, transfer 2 to another eligible Warehouse -> source 5, destination 2, company total 7. Repeating the same transfer request leaves those values unchanged. A failed destination write changes neither side. Reversing a receipt after its stock was consumed must respect negative-stock/fiscal rules rather than deleting its movement.

## Validation Evidence

The last assistant-observed full Inventory package execution remains Step 4: 72 tests passed, typecheck passed and build passed. Steps 5–10 add focused lifecycle/stock/workflow/contract/orchestration tests, but their current workspace execution has not been observed by the assistant environment. Steps 5–9 have explicit owner acceptance. No migration, performance gate or manual Desktop acceptance has been run in this phase yet.

Required implementation gates, to be executed and recorded at Steps 19–21:

- Frozen dependency install.
- Inventory and SQLite adapter tests/typechecks.
- Related Product/Warehouse/Fiscal/Security/Audit and Desktop regression suites.
- Full monorepo lint, typecheck, test and build.
- Desktop Rust `cargo check` and applicable repository Rust gates.
- Documentation index generation/link checks and manual Desktop/print acceptance.
- Add `pnpm validate:phase20` in Step 21.

## Documentation Impact

- Steps 2–9 created/updated the canonical Inventory Domain/workflow/Application-contract records and ADR-0018 through ADR-0020 as applicable.
- Step 10 added `inventory-application-services.md`, updated Application/UoW/idempotency/reversal contracts, exported the orchestration service and updated this canonical plan.
- Database design/dictionary, Bridge contract, permissions/approval policy, module registry/map and final generated documentation index remain updated in their owning steps.

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
